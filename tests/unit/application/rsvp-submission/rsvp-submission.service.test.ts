/**
 * Tests for RSVP Submission Application Service
 */

import { TRPCError } from '@trpc/server'

jest.mock('~/server/authz/permission-checker', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('~/server/domains/invitation/invitation.repository')
jest.mock('~/server/domains/question/question.repository')
jest.mock('~/server/domains/guest/guest.repository')
jest.mock('~/server/domains/household/household.repository')
jest.mock('~/server/domains/wedding/wedding.repository')

import { RsvpSubmissionService } from '~/server/application/rsvp-submission/rsvp-submission.service'
import { requirePermission } from '~/server/authz/permission-checker'
import {
  GuestRepository,
  mockCountByIdsInHousehold,
  mockCountByIdsInWedding as mockGuestCountByIdsInWedding,
  mockReplaceTagAlongs,
  resetMocks as resetGuestMocks,
} from '~/server/domains/guest/guest.repository'
import {
  HouseholdRepository,
  mockBelongsToWedding,
  mockCountByIdsInWedding as mockHouseholdCountByIdsInWedding,
  mockUpdateRsvpPartyDetails,
  resetMocks as resetHouseholdMocks,
} from '~/server/domains/household/household.repository'
import {
  InvitationRepository,
  mockCountByWeddingAndGuestEventPairs,
  mockUpdate,
  resetMocks as resetInvitationMocks,
} from '~/server/domains/invitation/invitation.repository'
import {
  mockAdjustOptionResponseCount,
  mockDeleteAnswer,
  mockDeleteOptionResponse,
  mockFindOptionResponse,
  mockUpsertAnswer,
  mockUpsertOptionResponse,
  QuestionRepository,
  resetMocks as resetQuestionMocks,
} from '~/server/domains/question/question.repository'
import {
  mockFindWeddingIdByValidTokenAndSubUrl,
  resetMocks as resetWeddingMocks,
  WeddingRepository,
} from '~/server/domains/wedding/wedding.repository'

const mockRequirePermission = requirePermission as jest.Mock

const createMockDb = () => ({
  $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
    return fn({ __tx: true })
  }),
  website: {
    findFirst: jest.fn().mockResolvedValue({ weddingId: 'wedding-123', isRsvpEnabled: true }),
  },
  invitation: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  rateLimitBucket: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({ count: 1 }),
    update: jest.fn().mockResolvedValue({ count: 1 }),
  },
})

describe('RsvpSubmissionService', () => {
  let service: RsvpSubmissionService
  let mockDb: ReturnType<typeof createMockDb>

  const actorContext = {
    userId: 'actor-1',
    activeOrganization: {
      organizationId: 'org-1',
      role: 'owner',
    },
  }

  beforeEach(() => {
    resetInvitationMocks()
    resetQuestionMocks()
    resetGuestMocks()
    resetHouseholdMocks()
    resetWeddingMocks()

    mockDb = createMockDb()
    mockRequirePermission.mockReset()
    mockRequirePermission.mockReturnValue({ organizationId: 'org-1', role: 'admin' })

    mockCountByWeddingAndGuestEventPairs.mockResolvedValue(1)
    mockGuestCountByIdsInWedding.mockResolvedValue(1)
    mockCountByIdsInHousehold.mockResolvedValue(1)
    mockHouseholdCountByIdsInWedding.mockResolvedValue(1)
    mockBelongsToWedding.mockResolvedValue(true)
    mockFindWeddingIdByValidTokenAndSubUrl.mockResolvedValue('wedding-123')
    mockFindOptionResponse.mockResolvedValue(null)

    const invitationRepo = new InvitationRepository({} as never)
    const questionRepo = new QuestionRepository({} as never)
    const guestRepo = new GuestRepository({} as never)
    const householdRepo = new HouseholdRepository({} as never)
    const weddingRepo = new WeddingRepository({} as never)

    service = new RsvpSubmissionService(
      invitationRepo,
      questionRepo,
      guestRepo,
      householdRepo,
      weddingRepo,
      mockDb as never
    )
  })

  it('requires rsvp edit permission for managed submissions', async () => {
    await service.submitManagedRsvp(actorContext, 'wedding-123', {
      rsvpResponses: [{ eventId: 'event-123', guestId: 1, rsvp: 'Attending' }],
      answersToQuestions: [],
    })

    expect(mockRequirePermission).toHaveBeenCalledWith(actorContext, { rsvp: ['edit_response'] })
  })

  it('rejects when rsvp permission is missing', async () => {
    mockRequirePermission.mockImplementation(() => {
      throw new Error('forbidden')
    })

    await expect(
      service.submitManagedRsvp(actorContext, 'wedding-123', {
        rsvpResponses: [],
        answersToQuestions: [],
      })
    ).rejects.toThrow('forbidden')

    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('updates invitations and question answers via repositories inside transaction', async () => {
    const result = await service.submitRsvp({
      rsvpResponses: [{ eventId: 'event-123', guestId: 1, rsvp: 'Attending' }],
      answersToQuestions: [
        {
          questionId: 'question-text',
          questionType: 'Text',
          response: 'Vegetarian',
          guestId: 1,
          householdId: 'household-123',
        },
        {
          questionId: 'question-option',
          questionType: 'Option',
          response: 'option-456',
          guestId: 1,
          householdId: 'household-123',
        },
      ],
    })

    expect(result).toEqual({ success: true })
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith(1, 'event-123', {
      rsvp: 'Attending',
      submittedAt: expect.any(Date),
    })
    expect(mockUpsertAnswer).toHaveBeenCalledWith({
      questionId: 'question-text',
      guestId: 1,
      householdId: 'household-123',
      response: 'Vegetarian',
      guestFirstName: undefined,
      guestLastName: undefined,
    })
    expect(mockUpsertOptionResponse).toHaveBeenCalledWith({
      questionId: 'question-option',
      optionId: 'option-456',
      guestId: 1,
      householdId: 'household-123',
      guestFirstName: undefined,
      guestLastName: undefined,
    })
    expect(mockDeleteAnswer).toHaveBeenCalledWith('question-option', 1, 'household-123')
    expect(mockAdjustOptionResponseCount).toHaveBeenCalledWith('option-456', 1)
  })

  it('updates option response and adjusts counts when selection changed', async () => {
    mockFindOptionResponse.mockResolvedValue({
      questionId: 'question-123',
      guestId: 1,
      householdId: 'household-123',
      optionId: 'old-option',
      guestFirstName: null,
      guestLastName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await service.submitRsvp({
      rsvpResponses: [],
      answersToQuestions: [
        {
          questionId: 'question-123',
          questionType: 'Option',
          response: 'new-option',
          guestId: 1,
          householdId: 'household-123',
        },
      ],
    })

    expect(mockUpsertOptionResponse).toHaveBeenCalledWith(
      expect.objectContaining({ optionId: 'new-option' })
    )
    expect(mockAdjustOptionResponseCount).toHaveBeenCalledWith('old-option', -1)
    expect(mockAdjustOptionResponseCount).toHaveBeenCalledWith('new-option', 1)
  })

  it('does not rewrite option response when selection is unchanged', async () => {
    mockFindOptionResponse.mockResolvedValue({
      questionId: 'question-123',
      guestId: 1,
      householdId: 'household-123',
      optionId: 'same-option',
      guestFirstName: null,
      guestLastName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await service.submitRsvp({
      rsvpResponses: [],
      answersToQuestions: [
        {
          questionId: 'question-123',
          questionType: 'Option',
          response: 'same-option',
          guestId: 1,
          householdId: 'household-123',
        },
      ],
    })

    expect(mockUpsertOptionResponse).not.toHaveBeenCalled()
    expect(mockAdjustOptionResponseCount).not.toHaveBeenCalled()
  })

  it('uses default identifiers for null guest/household IDs', async () => {
    await service.submitRsvp({
      rsvpResponses: [],
      answersToQuestions: [
        {
          questionId: 'question-123',
          questionType: 'Option',
          response: 'option-456',
          guestId: null,
          householdId: null,
        },
      ],
    })

    expect(mockFindOptionResponse).toHaveBeenCalledWith('question-123', -1, '-1')
    expect(mockUpsertOptionResponse).toHaveBeenCalledWith(
      expect.objectContaining({ guestId: -1, householdId: '-1' })
    )
  })

  it('clears prior option response when saving a text answer for an option question', async () => {
    mockFindOptionResponse.mockResolvedValue({
      optionId: 'option-123',
    })

    await service.submitRsvp({
      rsvpResponses: [],
      answersToQuestions: [
        {
          questionId: 'question-123',
          questionType: 'Text',
          response: 'Other: pescatarian',
          guestId: 1,
          householdId: 'household-123',
        },
      ],
    })

    expect(mockDeleteOptionResponse).toHaveBeenCalledWith('question-123', 1, 'household-123')
    expect(mockAdjustOptionResponseCount).toHaveBeenCalledWith('option-123', -1)
    expect(mockUpsertAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: 'question-123',
        response: 'Other: pescatarian',
      })
    )
  })

  it('writes the household RSVP party details alongside the per-guest invitation updates', async () => {
    const result = await service.submitRsvp(
      {
        rsvpResponses: [
          { eventId: 'event-123', guestId: 1, rsvp: 'Attending' },
          { eventId: 'event-123', guestId: 2, rsvp: 'Declined' },
        ],
        answersToQuestions: [],
      },
      {
        householdId: 'household-123',
        attendingCount: 4,
        childrenCount: 2,
        dietaryNotes: 'No nuts for guest 1',
      }
    )

    expect(result).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith(1, 'event-123', {
      rsvp: 'Attending',
      submittedAt: expect.any(Date),
    })
    expect(mockUpdate).toHaveBeenCalledWith(2, 'event-123', {
      rsvp: 'Declined',
      submittedAt: expect.any(Date),
    })
    expect(mockUpdateRsvpPartyDetails).toHaveBeenCalledWith('household-123', {
      attendingCount: 4,
      childrenCount: 2,
      dietaryNotes: 'No nuts for guest 1',
    })
  })

  it('preserves the existing dietary notes/wishes message when submitted blank, but clears them on an explicit null', async () => {
    await service.submitRsvp(
      {
        rsvpResponses: [{ eventId: 'event-123', guestId: 1, rsvp: 'Attending' }],
        answersToQuestions: [],
      },
      {
        householdId: 'household-123',
        dietaryNotes: '   ',
        wishesMessage: null,
      }
    )

    // A blank string means the guest left the field untouched (the step
    // seeds from whatever was already saved), so it must not overwrite the
    // stored value; only an explicit `null` clears it. See
    // preserveExistingWhenBlank in rsvp-submission.service.ts.
    expect(mockUpdateRsvpPartyDetails).toHaveBeenCalledWith('household-123', {
      attendingCount: undefined,
      childrenCount: undefined,
      dietaryNotes: undefined,
      wishesMessage: null,
    })
  })

  it('preserves meal counts when a chuppah-only submission omits them', async () => {
    await service.submitPublicRsvp(
      {
        subUrl: 'ash-and-jamie',
        householdId: 'household-123',
        rsvpResponses: [{ eventId: 'event-chuppah', guestId: 1, rsvp: 'Attending' }],
        answersToQuestions: [],
        wishesMessage: 'See you there',
      },
      '127.0.0.1'
    )

    expect(mockUpdateRsvpPartyDetails).toHaveBeenCalledWith('household-123', {
      attendingCount: undefined,
      childrenCount: undefined,
      dietaryNotes: undefined,
      wishesMessage: 'See you there',
    })
  })

  it('does not touch the household row when no party details are submitted', async () => {
    await service.submitRsvp({
      rsvpResponses: [{ eventId: 'event-123', guestId: 1, rsvp: 'Attending' }],
      answersToQuestions: [],
    })

    expect(mockUpdateRsvpPartyDetails).not.toHaveBeenCalled()
  })

  it('resolves the wedding from the subUrl and submits (no token needed)', async () => {
    const result = await service.submitPublicRsvp({
      subUrl: 'ash-and-jamie',
      rsvpResponses: [{ eventId: 'event-123', guestId: 1, rsvp: 'Attending' }],
      answersToQuestions: [],
    })

    expect(result).toEqual({ success: true })
    expect(mockDb.website.findFirst).toHaveBeenCalledWith({
      where: { subUrl: 'ash-and-jamie' },
      select: { weddingId: true, isRsvpEnabled: true },
    })
    // subUrl resolution succeeded, so the token path is not used.
    expect(mockFindWeddingIdByValidTokenAndSubUrl).not.toHaveBeenCalled()
  })

  it('falls back to a valid token when the site has RSVP disabled', async () => {
    mockDb.website.findFirst.mockResolvedValue({ weddingId: 'wedding-123', isRsvpEnabled: false })

    const result = await service.submitPublicRsvp({
      subUrl: 'ash-and-jamie',
      token: 'a'.repeat(32),
      rsvpResponses: [{ eventId: 'event-123', guestId: 1, rsvp: 'Attending' }],
      answersToQuestions: [],
    })

    expect(result).toEqual({ success: true })
    expect(mockFindWeddingIdByValidTokenAndSubUrl).toHaveBeenCalledWith(
      'ash-and-jamie',
      'a'.repeat(32)
    )
  })

  it('saves household party details from a submission scoped to one event even when the household is also invited to a non-RSVP event (e.g. the ceremony)', async () => {
    // The household is invited to the RSVP-collecting reception event *and*
    // the auto-created, non-collectRsvp "חופה וקידושין" ceremony event — a
    // submission reached via `?event=<reception>` only carries rsvpResponses
    // for the reception, so coverage is partial, but the household-level
    // fields must still be saved rather than silently dropped.
    mockDb.invitation.findMany.mockResolvedValue([
      { eventId: 'event-reception' },
      { eventId: 'event-chuppah' },
    ])

    const result = await service.submitPublicRsvp(
      {
        subUrl: 'ash-and-jamie',
        householdId: 'household-123',
        rsvpResponses: [{ eventId: 'event-reception', guestId: 1, rsvp: 'Attending' }],
        answersToQuestions: [],
        attendingCount: 2,
        childrenCount: 1,
        dietaryNotes: 'No nuts',
        extraGuestNames: ['Extra Guest'],
      },
      '127.0.0.1'
    )

    expect(result).toEqual({ success: true, partialHouseholdCoverage: true })
    expect(mockUpdateRsvpPartyDetails).toHaveBeenCalledWith('household-123', {
      attendingCount: 2,
      childrenCount: 1,
      dietaryNotes: 'No nuts',
      wishesMessage: undefined,
    })
  })

  it('keeps a tag-along attending an event the household attends, even when another guest in the household declines that same event', async () => {
    mockCountByIdsInHousehold.mockResolvedValue(2)
    mockCountByWeddingAndGuestEventPairs.mockResolvedValue(2)

    const result = await service.submitPublicRsvp(
      {
        subUrl: 'ash-and-jamie',
        householdId: 'household-123',
        rsvpResponses: [
          { eventId: 'event-123', guestId: 1, rsvp: 'Attending' },
          { eventId: 'event-123', guestId: 2, rsvp: 'Declined' },
        ],
        answersToQuestions: [],
        extraGuestNames: ['Extra Guest'],
      },
      '127.0.0.1'
    )

    expect(result).toEqual({ success: true })
    expect(mockReplaceTagAlongs).toHaveBeenCalledWith(
      'household-123',
      'wedding-123',
      ['Extra Guest'],
      ['event-123'],
      []
    )
  })

  it('creates invitation rows when only named extra guests are attending', async () => {
    const result = await service.submitPublicRsvp(
      {
        subUrl: 'ash-and-jamie',
        householdId: 'household-123',
        rsvpResponses: [{ eventId: 'event-123', guestId: 1, rsvp: 'Declined' }],
        answersToQuestions: [],
        attendingCount: 1,
        extraGuestNames: ['Extra Guest'],
      },
      '127.0.0.1'
    )

    expect(result).toEqual({ success: true })
    expect(mockReplaceTagAlongs).toHaveBeenCalledWith(
      'household-123',
      'wedding-123',
      ['Extra Guest'],
      ['event-123'],
      []
    )
  })

  it('rejects when the site is unknown or RSVP is disabled and no token is supplied', async () => {
    mockDb.website.findFirst.mockResolvedValue(null)

    await expect(
      service.submitPublicRsvp({
        subUrl: 'ash-and-jamie',
        rsvpResponses: [],
        answersToQuestions: [],
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'RSVP is not available for this wedding',
    })
  })

  it('rejects a fallback token that is invalid or expired', async () => {
    mockDb.website.findFirst.mockResolvedValue({ weddingId: 'wedding-123', isRsvpEnabled: false })
    mockFindWeddingIdByValidTokenAndSubUrl.mockResolvedValue(null)

    await expect(
      service.submitPublicRsvp({
        subUrl: 'ash-and-jamie',
        token: 'a'.repeat(32),
        rsvpResponses: [],
        answersToQuestions: [],
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Invalid or expired RSVP token',
    })
  })

  it('rejects when submission scope does not belong to wedding', async () => {
    mockCountByWeddingAndGuestEventPairs.mockResolvedValue(0)

    await expect(
      service.submitManagedRsvp(actorContext, 'wedding-123', {
        rsvpResponses: [{ eventId: 'event-123', guestId: 1, rsvp: 'Attending' }],
        answersToQuestions: [],
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('rejects when guest or household ids are outside wedding scope', async () => {
    mockCountByWeddingAndGuestEventPairs.mockResolvedValue(1)
    mockGuestCountByIdsInWedding.mockResolvedValue(0)

    await expect(
      service.submitManagedRsvp(actorContext, 'wedding-123', {
        rsvpResponses: [{ eventId: 'event-123', guestId: 1, rsvp: 'Attending' }],
        answersToQuestions: [
          { questionId: 'q', questionType: 'Text', response: 'x', householdId: 'h-1' },
        ],
      })
    ).rejects.toBeInstanceOf(TRPCError)
  })
})
