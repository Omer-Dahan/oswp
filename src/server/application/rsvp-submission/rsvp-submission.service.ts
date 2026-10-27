/**
 * RSVP Submission Application Service
 *
 * Handles the complete RSVP submission flow from the guest-facing website.
 * Orchestrates multiple domains:
 * - Invitation domain (RSVP status updates)
 * - Question domain (answer submissions)
 * - Wedding domain (public token validation)
 */

// biome-ignore lint/style/noRestrictedImports: Application services use PrismaClient for cross-domain transactions
import type { PrismaClient } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { logger } from '~/lib/observability/logger'
import type {
  SubmitPublicRsvpSchemaInput,
  SubmitRsvpSchemaInput,
} from '~/server/application/rsvp-submission/rsvp-submission.validator'
import type { AuthzContext } from '~/server/authz/authorization.types'
import { requirePermission } from '~/server/authz/permission-checker'
import { GuestRepository } from '~/server/domains/guest/guest.repository'
import { HouseholdRepository } from '~/server/domains/household/household.repository'
import { InvitationRepository } from '~/server/domains/invitation/invitation.repository'
import { QuestionRepository } from '~/server/domains/question/question.repository'
import type { WeddingRepository } from '~/server/domains/wedding/wedding.repository'
import { PrismaRateLimiter } from '~/server/infrastructure/rate-limit'

// Re-use types from validator for internal use
type RsvpResponse = SubmitRsvpSchemaInput['rsvpResponses'][number]
type AnswerToQuestion = SubmitRsvpSchemaInput['answersToQuestions'][number]
type PublicRsvpResponse = SubmitPublicRsvpSchemaInput['rsvpResponses'][number]

/** Extract the caller's IP from standard proxy headers, for rate limiting only. */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for')
  const first = forwardedFor?.split(',')[0]?.trim()
  if (first) return first
  return headers.get('x-real-ip') ?? 'unknown'
}

/**
 * `undefined` means the submission never supplied this field (e.g. the
 * guest's client failed to fetch their previously-saved value) — and a blank
 * string means the guest left the field untouched rather than explicitly
 * clearing it, since the dietary-notes/wishes-message steps always seed from
 * whatever was already saved. Both cases must preserve the existing stored
 * value instead of overwriting it with blank; only an explicit `null` clears
 * it.
 */
function preserveExistingWhenBlank(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return value.trim() === '' ? undefined : value
}

export class RsvpSubmissionService {
  private rateLimiter: PrismaRateLimiter

  constructor(
    private invitationRepo: InvitationRepository,
    private questionRepo: QuestionRepository,
    private guestRepo: GuestRepository,
    private householdRepo: HouseholdRepository,
    private weddingRepo: WeddingRepository,
    private db: PrismaClient
  ) {
    // Generous enough for a guest retrying a validation error across a
    // multi-step form, tight enough to stop a scripted tampering sweep.
    this.rateLimiter = new PrismaRateLimiter(db, { limit: 20, windowMs: 15 * 60_000 })
  }

  async submitManagedRsvp(
    ctx: AuthzContext,
    weddingId: string,
    data: SubmitRsvpSchemaInput
  ): Promise<{ success: boolean }> {
    requirePermission(ctx, { rsvp: ['edit_response'] })
    await this.ensureSubmissionBelongsToWedding(weddingId, data)
    return this.submitRsvp(data)
  }

  async submitPublicRsvp(
    data: SubmitPublicRsvpSchemaInput,
    clientIp: string
  ): Promise<{ success: boolean; partialHouseholdCoverage?: boolean }> {
    const allowed = await this.rateLimiter.check(`rsvp:${clientIp}:${data.subUrl}`)
    if (!allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'יותר מדי ניסיונות שליחה. נסו שוב בעוד כמה דקות.',
      })
    }

    const weddingId = await this.resolvePublicSubmitWeddingId(data.subUrl, data.token)
    await this.ensurePublicSubmissionIsValid(weddingId, data.householdId, data)

    const allowedRsvpResponses = await this.filterOutNotInvited(weddingId, data.rsvpResponses)

    if (data.rsvpResponses.length > 0 && allowedRsvpResponses.length === 0) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'לא ניתן לעדכן אישור הגעה עבור הזמנה שבוטלה',
      })
    }

    // A submission scoped to a single event (reached via `?event=` on the
    // RSVP link) only carries that event's rsvpResponses — but the household
    // fields in the payload (attendingCount, dietaryNotes, extraGuestNames,
    // ...) are always collected for the whole household regardless of which
    // event the form was scoped to, so they must never be silently dropped.
    // `coversAllHouseholdEvents` is only used to flag the mismatch for
    // observability, not to gate whether the data gets saved.
    const isFullHouseholdSubmission = await this.coversAllHouseholdEvents(
      data.householdId,
      allowedRsvpResponses
    )

    if (!isFullHouseholdSubmission) {
      logger.warn(
        'Public RSVP submission did not cover every event the household is invited to; saving the submitted household details anyway',
        { component: 'rsvp', household_id: data.householdId, wedding_id: weddingId }
      )
    }

    const result = await this.submitRsvp(
      {
        rsvpResponses: allowedRsvpResponses,
        answersToQuestions: data.answersToQuestions,
      },
      {
        householdId: data.householdId,
        attendingCount: data.attendingCount,
        childrenCount: data.childrenCount,
        dietaryNotes: data.dietaryNotes,
        wishesMessage: data.wishesMessage,
        weddingId,
        extraGuestNames: data.extraGuestNames,
      }
    )

    return {
      ...result,
      ...(isFullHouseholdSubmission ? null : { partialHouseholdCoverage: true }),
    }
  }

  /**
   * Whether `responses` touches every event this household currently holds
   * an invitation for (excluding events it was never invited to). A
   * household with no invitations at all (e.g. still mid-search) counts as
   * "full" since there's nothing narrower to compare against. Used only to
   * flag an incomplete submission for observability — see submitPublicRsvp.
   */
  private async coversAllHouseholdEvents(
    householdId: string,
    responses: PublicRsvpResponse[]
  ): Promise<boolean> {
    const invitedEvents = await this.db.invitation.findMany({
      where: {
        guest: { householdId },
        rsvp: { not: 'Not Invited' },
      },
      select: { eventId: true },
      distinct: ['eventId'],
    })

    if (invitedEvents.length === 0) return true

    const submittedEventIds = new Set(responses.map((response) => response.eventId))
    return invitedEvents.every(({ eventId }) => submittedEventIds.has(eventId))
  }

  /**
   * Resolve the wedding a public RSVP submission belongs to.
   *
   * Guests reach the RSVP form from the wedding website (name search or
   * save-the-date recognition), so the submission is scoped by the website's
   * subUrl — mirroring the public name search. A shared self-fill link may still
   * carry a token, which is honored as a fallback. The submission is separately
   * verified to belong to this wedding in `ensurePublicSubmissionIsValid`.
   */
  private async resolvePublicSubmitWeddingId(
    subUrl: string,
    token: string | undefined
  ): Promise<string> {
    const website = await this.db.website.findFirst({
      where: { subUrl },
      select: { weddingId: true, isRsvpEnabled: true },
    })

    if (website?.isRsvpEnabled) {
      return website.weddingId
    }

    if (token) {
      return this.getWeddingIdFromValidToken(subUrl, token)
    }

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'RSVP is not available for this wedding',
    })
  }

  async submitRsvp(
    data: SubmitRsvpSchemaInput,
    householdPartyDetails?: {
      householdId: string
      attendingCount?: number | null
      childrenCount?: number | null
      dietaryNotes?: string | null
      wishesMessage?: string | null
      weddingId?: string
      extraGuestNames?: string[]
    }
  ): Promise<{ success: boolean }> {
    await this.db.$transaction(async (tx) => {
      const txInvitationRepo = new InvitationRepository(tx)
      const txQuestionRepo = new QuestionRepository(tx)
      const txHouseholdRepo = new HouseholdRepository(tx)
      const txGuestRepo = new GuestRepository(tx)

      for (const response of data.rsvpResponses as RsvpResponse[]) {
        await txInvitationRepo.update(response.guestId, response.eventId, {
          rsvp: response.rsvp,
          submittedAt: new Date(),
        })
      }

      for (const answer of data.answersToQuestions as AnswerToQuestion[]) {
        if (answer.questionType === 'Option') {
          await this.processOptionAnswer(txQuestionRepo, answer)
        } else {
          await this.processTextAnswer(txQuestionRepo, answer)
        }
      }

      if (householdPartyDetails) {
        await txHouseholdRepo.updateRsvpPartyDetails(householdPartyDetails.householdId, {
          attendingCount: householdPartyDetails.attendingCount ?? null,
          childrenCount: householdPartyDetails.childrenCount ?? null,
          dietaryNotes: preserveExistingWhenBlank(householdPartyDetails.dietaryNotes),
          wishesMessage: preserveExistingWhenBlank(householdPartyDetails.wishesMessage),
        })

        if (householdPartyDetails.weddingId && householdPartyDetails.extraGuestNames) {
          // Extra guests aren't tied to a specific event in the UI — their count
          // is a single household-wide total, so they tag along to whichever
          // events a named guest actually attends. Only when nobody named is
          // attending anywhere do they fall back to events the household
          // hasn't explicitly declined (events never invited to were already
          // dropped before reaching here).
          const namedAttendingGuestIds = new Set(
            data.rsvpResponses
              .filter((response) => response.rsvp === 'Attending')
              .map((response) => response.guestId)
          )

          const attendingEventIds = Array.from(
            new Set(
              namedAttendingGuestIds.size > 0
                ? data.rsvpResponses
                    .filter((response) => response.rsvp === 'Attending')
                    .map((response) => response.eventId)
                : householdPartyDetails.extraGuestNames.length > 0
                  ? data.rsvpResponses.map((response) => response.eventId)
                  : data.rsvpResponses
                      .filter((response) => response.rsvp !== 'Declined')
                      .map((response) => response.eventId)
            )
          )

          const attendingEventIdSet = new Set(attendingEventIds)

          const declinedEventIds = Array.from(
            new Set(
              data.rsvpResponses
                .filter(
                  (response) =>
                    response.rsvp === 'Declined' && !attendingEventIdSet.has(response.eventId)
                )
                .map((response) => response.eventId)
            )
          )

          await txGuestRepo.replaceTagAlongs(
            householdPartyDetails.householdId,
            householdPartyDetails.weddingId,
            householdPartyDetails.extraGuestNames,
            attendingEventIds,
            declinedEventIds
          )
        }
      }
    })

    return { success: true }
  }

  private async processOptionAnswer(
    questionRepo: QuestionRepository,
    answer: AnswerToQuestion
  ): Promise<void> {
    const guestId = answer.guestId ?? -1
    const householdId = answer.householdId ?? '-1'

    await questionRepo.deleteAnswer(answer.questionId, guestId, householdId)

    const existingResponse = await questionRepo.findOptionResponse(
      answer.questionId,
      guestId,
      householdId
    )

    if (existingResponse === null) {
      await questionRepo.upsertOptionResponse({
        questionId: answer.questionId,
        optionId: answer.response,
        guestId,
        guestFirstName: answer.guestFirstName,
        guestLastName: answer.guestLastName,
        householdId,
      })
      await questionRepo.adjustOptionResponseCount(answer.response, 1)
      return
    }

    if (existingResponse.optionId !== answer.response) {
      await questionRepo.upsertOptionResponse({
        questionId: answer.questionId,
        optionId: answer.response,
        guestId,
        guestFirstName: answer.guestFirstName,
        guestLastName: answer.guestLastName,
        householdId,
      })
      await questionRepo.adjustOptionResponseCount(existingResponse.optionId, -1)
      await questionRepo.adjustOptionResponseCount(answer.response, 1)
    }
  }

  private async processTextAnswer(
    questionRepo: QuestionRepository,
    answer: AnswerToQuestion
  ): Promise<void> {
    const guestId = answer.guestId ?? -1
    const householdId = answer.householdId ?? '-1'
    const existingResponse = await questionRepo.findOptionResponse(
      answer.questionId,
      guestId,
      householdId
    )

    if (existingResponse !== null) {
      await questionRepo.deleteOptionResponse(answer.questionId, guestId, householdId)
      await questionRepo.adjustOptionResponseCount(existingResponse.optionId, -1)
    }

    await questionRepo.upsertAnswer({
      questionId: answer.questionId,
      guestId,
      householdId,
      response: answer.response,
      guestFirstName: answer.guestFirstName,
      guestLastName: answer.guestLastName,
    })
  }

  private async getWeddingIdFromValidToken(subUrl: string, token: string): Promise<string> {
    const weddingId = await this.weddingRepo.findWeddingIdByValidTokenAndSubUrl(subUrl, token)

    if (!weddingId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Invalid or expired RSVP token',
      })
    }

    return weddingId
  }

  /**
   * Drop rsvpResponses targeting an invitation whose current status is
   * 'Not Invited' — the guest was never invited to that event, so a public
   * submission must not silently create an RSVP for it.
   */
  private async filterOutNotInvited(
    weddingId: string,
    responses: PublicRsvpResponse[]
  ): Promise<PublicRsvpResponse[]> {
    if (responses.length === 0) return responses

    const statuses = await this.invitationRepo.findRsvpStatusesForPairs(
      weddingId,
      responses.map((response) => ({ guestId: response.guestId, eventId: response.eventId }))
    )

    const notInvitedKeys = new Set(
      statuses
        .filter((status) => status.rsvp === 'Not Invited')
        .map((status) => `${status.guestId}:${status.eventId}`)
    )

    return responses.filter(
      (response) => !notInvitedKeys.has(`${response.guestId}:${response.eventId}`)
    )
  }

  /**
   * Validate a public submission end-to-end: the household belongs to the
   * resolved wedding, every guestId in the payload belongs to that household,
   * every guest/event pair is a real invitation in this wedding, and every
   * question/option answered belongs to this wedding too.
   */
  private async ensurePublicSubmissionIsValid(
    weddingId: string,
    householdId: string,
    data: Pick<SubmitPublicRsvpSchemaInput, 'rsvpResponses' | 'answersToQuestions'>
  ): Promise<void> {
    const householdBelongsToWedding = await this.householdRepo.belongsToWedding(
      householdId,
      weddingId
    )

    if (!householdBelongsToWedding) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'משק הבית אינו שייך לחתונה הזו',
      })
    }

    const guestIds = new Set<number>()

    for (const response of data.rsvpResponses) {
      guestIds.add(response.guestId)
    }

    for (const answer of data.answersToQuestions) {
      if (typeof answer.guestId === 'number') {
        guestIds.add(answer.guestId)
      }

      if (typeof answer.householdId === 'string' && answer.householdId !== householdId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'אחת התשובות משויכת למשק בית אחר',
        })
      }
    }

    if (guestIds.size > 0) {
      const guestCount = await this.guestRepo.countByIdsInHousehold(
        householdId,
        Array.from(guestIds)
      )

      if (guestCount !== guestIds.size) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'חלק מהאורחים בטופס אינם שייכים למשק הבית הזה',
        })
      }
    }

    if (data.rsvpResponses.length > 0) {
      const invitationCount = await this.invitationRepo.countByWeddingAndGuestEventPairs(
        weddingId,
        data.rsvpResponses.map((response) => ({
          guestId: response.guestId,
          eventId: response.eventId,
        }))
      )

      if (invitationCount !== data.rsvpResponses.length) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'טווח ה-RSVP שנשלח אינו תקין',
        })
      }
    }

    await this.ensureQuestionsAndOptionsBelongToWedding(weddingId, data.answersToQuestions)
  }

  /**
   * Verify every answered questionId belongs to this wedding, and for
   * multiple-choice answers, that the submitted optionId actually belongs to
   * that question — otherwise a foreign optionId would increment another
   * wedding's response counter.
   */
  private async ensureQuestionsAndOptionsBelongToWedding(
    weddingId: string,
    answers: SubmitPublicRsvpSchemaInput['answersToQuestions']
  ): Promise<void> {
    if (answers.length === 0) return

    const questionIds = Array.from(new Set(answers.map((answer) => answer.questionId)))
    const validQuestionIds = await this.questionRepo.findQuestionIdsInWedding(
      weddingId,
      questionIds
    )

    if (validQuestionIds.length !== questionIds.length) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'אחת השאלות בטופס אינה שייכת לחתונה הזו',
      })
    }

    const optionAnswers = answers.filter((answer) => answer.questionType === 'Option')
    if (optionAnswers.length === 0) return

    const optionIds = Array.from(new Set(optionAnswers.map((answer) => answer.response)))
    const options = await this.questionRepo.findOptionsByIds(optionIds)
    const questionIdByOptionId = new Map(options.map((option) => [option.id, option.questionId]))

    for (const answer of optionAnswers) {
      if (questionIdByOptionId.get(answer.response) !== answer.questionId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'אחת התשובות מצביעה על אפשרות שאינה שייכת לשאלה הזו',
        })
      }
    }
  }

  private async ensureSubmissionBelongsToWedding(
    weddingId: string,
    data: Pick<SubmitRsvpSchemaInput, 'rsvpResponses' | 'answersToQuestions'>
  ): Promise<void> {
    if (data.rsvpResponses.length > 0) {
      const invitationCount = await this.invitationRepo.countByWeddingAndGuestEventPairs(
        weddingId,
        data.rsvpResponses.map((response) => ({
          guestId: response.guestId,
          eventId: response.eventId,
        }))
      )

      if (invitationCount !== data.rsvpResponses.length) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Invalid RSVP submission scope for token',
        })
      }
    }

    const guestIds = new Set<number>()
    const householdIds = new Set<string>()

    for (const response of data.rsvpResponses) {
      guestIds.add(response.guestId)
    }

    for (const answer of data.answersToQuestions) {
      if (typeof answer.guestId === 'number') {
        guestIds.add(answer.guestId)
      }

      if (typeof answer.householdId === 'string') {
        householdIds.add(answer.householdId)
      }
    }

    if (guestIds.size > 0) {
      const guestCount = await this.guestRepo.countByIdsInWedding(weddingId, Array.from(guestIds))

      if (guestCount !== guestIds.size) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Invalid RSVP submission scope for token',
        })
      }
    }

    if (householdIds.size > 0) {
      const householdCount = await this.householdRepo.countByIdsInWedding(
        weddingId,
        Array.from(householdIds)
      )

      if (householdCount !== householdIds.size) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Invalid RSVP submission scope for token',
        })
      }
    }
  }
}
