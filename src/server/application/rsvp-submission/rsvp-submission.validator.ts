/**
 * RSVP Submission Application Service - Validators
 *
 * Zod schemas for validating RSVP form submissions.
 */

import { z } from 'zod'

/**
 * Schema for RSVP response (guest/event combination)
 */
export const rsvpResponseSchema = z.object({
  eventId: z.string(),
  guestId: z.number(),
  rsvp: z.string(),
})

export type RsvpResponseSchemaInput = z.infer<typeof rsvpResponseSchema>

/**
 * Public (guest-facing) RSVP response. A guest can only declare attendance or
 * decline — 'Invited' and 'Not Invited' are states the couple controls, never
 * the public submission.
 */
export const publicRsvpResponseSchema = rsvpResponseSchema.extend({
  rsvp: z.enum(['Attending', 'Declined']),
})

export type PublicRsvpResponseSchemaInput = z.infer<typeof publicRsvpResponseSchema>

/**
 * Schema for question answers
 */
export const answerToQuestionSchema = z.object({
  questionId: z.string(),
  questionType: z.string(),
  response: z.string(),
  guestId: z.number().nullish(),
  householdId: z.string().nullish(),
  selectedOptionId: z.string().optional(),
  guestFirstName: z.string().optional().nullish(),
  guestLastName: z.string().optional().nullish(),
})

export type AnswerToQuestionSchemaInput = z.infer<typeof answerToQuestionSchema>

/**
 * Reject duplicate RSVP responses or question answers within one submission.
 * Shared between the managed and public schemas so both forms of submission
 * enforce the same per-payload invariants.
 */
function rejectDuplicateSubmissions(
  data: {
    rsvpResponses: Array<{ eventId: string; guestId: number }>
    answersToQuestions: Array<{
      questionId: string
      guestId?: number | null
      householdId?: string | null
    }>
  },
  ctx: z.RefinementCtx
): void {
  const rsvpKeys = new Set<string>()
  data.rsvpResponses.forEach((response, index) => {
    const key = `${response.eventId}:${response.guestId}`
    if (rsvpKeys.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate RSVP response for the same guest and event',
        path: ['rsvpResponses', index],
      })
      return
    }
    rsvpKeys.add(key)
  })

  const answerKeys = new Set<string>()
  data.answersToQuestions.forEach((answer, index) => {
    const key = `${answer.questionId}:${answer.guestId ?? -1}:${answer.householdId ?? '-1'}`
    if (answerKeys.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate question answer for the same question and guest/household',
        path: ['answersToQuestions', index],
      })
      return
    }
    answerKeys.add(key)
  })
}

/**
 * Schema for complete RSVP form submission (authenticated coordinator flow)
 */
export const submitRsvpSchema = z
  .object({
    rsvpResponses: z.array(rsvpResponseSchema),
    answersToQuestions: z.array(answerToQuestionSchema),
  })
  .superRefine(rejectDuplicateSubmissions)

export type SubmitRsvpSchemaInput = z.infer<typeof submitRsvpSchema>

export const submitPublicRsvpSchema = z
  .object({
    rsvpResponses: z.array(publicRsvpResponseSchema),
    answersToQuestions: z.array(answerToQuestionSchema),
    subUrl: z.string().min(1, 'Sub URL is required'),
    // The public RSVP submission is scoped by subUrl (the wedding website the guest
    // is RSVPing on). A token is only present when the guest arrived via a shared
    // self-fill link, so it's optional.
    token: z
      .string()
      .regex(/^[a-f0-9]{32}$/, 'Invalid RSVP token format')
      .optional(),
    // The household the guest searched for (or was recognized as via their
    // save-the-date invite). Binds the submission so a crafted payload can't
    // rewrite another household's RSVPs even though every guestId still
    // belongs to the same wedding.
    householdId: z.string().min(1, 'Household is required'),
    // Household-level party details collected on the who-is-coming,
    // children-count, and dietary-notes steps. All optional: a guest may
    // decline to answer any of them.
    attendingCount: z.number().int().min(0).max(20, 'ניתן לדווח על עד 20 מגיעים').nullish(),
    childrenCount: z.number().int().min(0).max(20, 'ניתן לדווח על עד 20 מגיעים').nullish(),
    dietaryNotes: z.string().max(500).nullish(),
    // Named "extra" guests added on the who-is-coming step. Persisted as real
    // tag-along Guest rows (see RsvpSubmissionService.submitRsvp), capped at
    // the same MAX_ATTENDING ceiling as the rest of the household's party.
    extraGuestNames: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  })
  .superRefine(rejectDuplicateSubmissions)

export type SubmitPublicRsvpSchemaInput = z.infer<typeof submitPublicRsvpSchema>
