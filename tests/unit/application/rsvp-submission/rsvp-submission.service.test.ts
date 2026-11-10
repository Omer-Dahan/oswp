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

const createMockDb = () => {
  const db = {
    $transaction: jest.fn(),
    website: {
      findFirst: jest.fn().mockResolvedValue({ weddingId: 'wedding-123', isRsvpEnabled: true }),
    },
    invitation: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    guest: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 1,
          weddingId: 'wedding-123',
          householdId: 'household-123',
          firstName: 'Ari',
          lastName: 'Cohen',
        },
      ]),
    },
    household: {
      // No count stored yet by default, so a derived count may backfill it —
      // tests that care about an already-stored count override this.
      findUnique: jest.fn().mockResolvedValue({ attendingCount: null, childrenCount: null }),
    },
    event: {
      // No wedding-events shape by default, so the chuppah-only decline rule
      // (needs a resolvable chuppah + wedding event pair) never fires unless
      // a test opts in by overriding this.
      findMany: jest.fn().mockResolvedValue([]),
    },
    rsvpSubmission: {
      create: jest.fn().mockResolvedValue({ id: 'submission-123' }),
    },
    rateLimitBucket: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ count: 1 }),
    },
  }
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db))
  return db
}

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

    expect(result).toEqual({
      success: true,
      attendingCount: 1,
      childrenCount: 0,
      submittedAt: expect.any(Date),
    })
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

    expect(result).toEqual({
      success: true,
      attendingCount: 4,
      childrenCount: 2,
      submittedAt: expect.any(Date),
    })
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
      wishesMessage: undefined,
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
      attendingCount: 1,
      childrenCount: 0,
      dietaryNotes: undefined,
      wishesMessage: null,
    })
  })

  it('derives safe counts when an attending submission omits them', async () => {
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
      attendingCount: 1,
      childrenCount: 0,
      dietaryNotes: undefined,
      wishesMessage: 'See you there',
    })
  })

  it('writes one site submission record with the persisted counts and source', async () => {
    const result = await service.submitPublicRsvp(
      {
        subUrl: 'ash-and-jamie',
        householdId: 'household-123',
        rsvpResponses: [{ eventId: 'event-123', guestId: 1, rsvp: 'Attending' }],
        answersToQuestions: [],
      },
      '127.0.0.1'
    )

    expect(result).toEqual(
      expect.objectContaining({
        attendingCount: 1,
        childrenCount: 0,
        submittedAt: expect.any(Date),
      })
    )
    expect(mockDb.rsvpSubmission.create).toHaveBeenCalledTimes(1)
    expect(mockDb.rsvpSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        weddingId: 'wedding-123',
        householdId: 'household-123',
        source: 'site',
        attendingCount: 1,
        childrenCount: 0,
        namedAttendeeNames: ['Ari Cohen'],
      }),
    })
  })

  it('persists two when two named guests are attending', async () => {
    mockCountByIdsInHousehold.mockResolvedValue(2)
    mockCountByWeddingAndGuestEventPairs.mockResolvedValue(2)
    mockDb.guest.findMany.mockResolvedValue([
      {
        id: 1,
        weddingId: 'wedding-123',
        householdId: 'household-123',
        firstName: 'Ari',
        lastName: 'Cohen',
      },
      {
        id: 2,
        weddingId: 'wedding-123',
        householdId: 'household-123',
        firstName: 'Noa',
        lastName: 'Cohen',
      },
    ])

    const result = await service.submitPublicRsvp(
      {
        subUrl: 'ash-and-jamie',
        householdId: 'household-123',
        rsvpResponses: [
          { eventId: 'event-123', guestId: 1, rsvp: 'Attending' },
          { eventId: 'event-123', guestId: 2, rsvp: 'Attending' },
        ],
        answersToQuestions: [],
      },
      '127.0.0.1'
    )

    expect(result).toEqual(expect.objectContaining({ attendingCount: 2, childrenCount: 0 }))
    expect(mockUpdateRsvpPartyDetails).toHaveBeenCalledWith(
      'household-123',
      expect.objectContaining({ attendingCount: 2, childrenCount: 0 })
    )
  })

  it('writes an explicit decline (0) to the household even though the audit row stores null for "no one attending"', async () => {
    await service.submitPublicRsvp(
      {
        subUrl: 'ash-and-jamie',
        householdId: 'household-123',
        rsvpResponses: [{ eventId: 'event-123', guestId: 1, rsvp: 'Declined' }],
        answersToQuestions: [],
        attendingCount: 0,
        childrenCount: 0,
      },
      '127.0.0.1'
    )

    // An explicit 0 is real information from this submission ("nobody is
    // coming"), unlike an omitted count, so it overwrites the household
    // column — unlike the derived-and-missing case, it is not a backfill.
    expect(mockUpdateRsvpPartyDetails).toHaveBeenCalledWith(
      'household-123',
      expect.objectContaining({ attendingCount: 0, childrenCount: 0 })
    )
    // The audit row is untouched by this rule: it keeps recording what
    // deriveRsvpCounts says about "no one attending" (null), independent of
    // what gets written to the household's own column.
    expect(mockDb.rsvpSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ attendingCount: null, childrenCount: null, source: 'site' }),
    })
  })

  it('does not overwrite a household’s confirmed headcount with a chuppah-only submission that carries no counts', async () => {
    mockDb.household.findUnique.mockResolvedValueOnce({ attendingCount: 4, childrenCount: 2 })

    await service.submitPublicRsvp(
      {
        subUrl: 'ash-and-jamie',
        householdId: 'household-123',
        rsvpResponses: [{ eventId: 'event-chuppah', guestId: 1, rsvp: 'Attending' }],
        answersToQuestions: [],
      },
      '127.0.0.1'
    )

    expect(mockUpdateRsvpPartyDetails).toHaveBeenCalledWith(
      'household-123',
      expect.objectContaining({ attendingCount: undefined, childrenCount: undefined })
    )
    expect(mockDb.rsvpSubmission.create).toHaveBeenCalledTimes(1)
  })

  it('backfills a chuppah-only count onto a household that has never recorded one', async () => {
    mockDb.household.findUnique.mockResolvedValueOnce({ attendingCount: null, childrenCount: null })

    await service.submitPublicRsvp(
      {
        subUrl: 'ash-and-jamie',
        householdId: 'household-123',
        rsvpResponses: [{ eventId: 'event-chuppah', guestId: 1, rsvp: 'Attending' }],
        answersToQuestions: [],
      },
      '127.0.0.1'
    )

    expect(mockUpdateRsvpPartyDetails).toHaveBeenCalledWith(
      'household-123',
      expect.objectContaining({ attendingCount: 1, childrenCount: 0 })
    )
  })

  it("overwrites an admin-corrected attendingCount once the guest submits their own explicit count", async () => {
    // Owner's decision 06.11.2026: an admin may fix the household's
    // attendingCount by hand (e.g. "8" was wrong, should be "4"). That manual
    // edit must not block the guest's own answer from winning once they
    // actually submit - there's no marker distinguishing an admin-written
    // value from any other stored value, so the normal explicit-wins rule
    // (see resolveHouseholdCountWrite) already covers this.
    mockDb.household.findUnique.mockResolvedValueOnce({ attendingCount: 4, childrenCount: 0 })

    await service.submitPublicRsvp(
      {
        subUrl: 'ash-and-jamie',
        householdId: 'household-123',
        rsvpResponses: [{ eventId: 'event-123', guestId: 1, rsvp: 'Attending' }],
        answersToQuestions: [],
        attendingCount: 2,
        childrenCount: 0,
      },
      '127.0.0.1'
    )

    expect(mockUpdateRsvpPartyDetails).toHaveBeenCalledWith(
      'household-123',
      expect.objectContaining({ attendingCount: 2, childrenCount: 0 })
    )
  })

  it('records the admin source for managed submissions', async () => {
    await service.submitManagedRsvp(actorContext, 'wedding-123', {
      rsvpResponses: [{ eventId: 'event-123', guestId: 1, rsvp: 'Attending' }],
      answersToQuestions: [],
    })

    expect(mockDb.rsvpSubmission.create).toHaveBeenCalledTimes(1)
    expect(mockDb.rsvpSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ source: 'admin' }),
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

    expect(result).toEqual(expect.objectContaining({ success: true }))
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

    expect(result).toEqual(expect.objectContaining({ success: true }))
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

    expect(result).toEqual(
      expect.objectContaining({ success: true, partialHouseholdCoverage: true })
    )
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

    expect(result).toEqual(expect.objectContaining({ success: true }))
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

    expect(result).toEqual(expect.objectContaining({ success: true }))
    expect(mockReplaceTagAlongs).toHaveBeenCalledWith(
      'household-123',
      'wedding-123',
      ['Extra Guest'],
      ['event-123'],
      []
    )
  })

  describe('chuppah-only decline (owner decision, 05.11.2026)', () => {
    const CHUPPAH_EVENT = { id: 'event-chuppah', name: 'חופה', isPrimary: false, collectRsvp: true }
    const WEDDING_EVENT = { id: 'event-wedding', name: 'החתונה', isPrimary: true, collectRsvp: true }

    /** Stubs the per-household invitations lookup with a fixed chuppah/wedding state, leaving the guest-id lookup untouched. */
    const stubHouseholdInvitations = (
      invitations: Array<{ eventId: string; rsvp: string }>
    ): void => {
      mockDb.guest.findMany.mockImplementation((args: { where?: { householdId?: string } }) => {
        if (args.where?.householdId) {
          return Promise.resolve([{ invitations }])
        }
        return Promise.resolve([
          {
            id: 1,
            weddingId: 'wedding-123',
            householdId: 'household-123',
            firstName: 'Ari',
            lastName: 'Cohen',
          },
        ])
      })
    }

    beforeEach(() => {
      mockDb.event.findMany.mockResolvedValue([CHUPPAH_EVENT, WEDDING_EVENT])
    })

    it('declines the wedding invitation for a household attending only the chuppah', async () => {
      stubHouseholdInvitations([
        { eventId: CHUPPAH_EVENT.id, rsvp: 'Attending' },
        { eventId: WEDDING_EVENT.id, rsvp: 'Invited' },
      ])

      await service.submitPublicRsvp(
        {
          subUrl: 'ash-and-jamie',
          householdId: 'household-123',
          rsvpResponses: [{ eventId: CHUPPAH_EVENT.id, guestId: 1, rsvp: 'Attending' }],
          answersToQuestions: [],
        },
        '127.0.0.1'
      )

      // Declined without a submittedAt: the guest never answered the
      // wedding event, the rule did, so no audit timestamp is fabricated.
      expect(mockDb.invitation.updateMany).toHaveBeenCalledWith({
        where: { guest: { householdId: 'household-123' }, eventId: WEDDING_EVENT.id, rsvp: 'Invited' },
        data: { rsvp: 'Declined' },
      })
    })

    it('leaves the wedding invitation alone when the household also answered the wedding event', async () => {
      stubHouseholdInvitations([
        { eventId: CHUPPAH_EVENT.id, rsvp: 'Attending' },
        { eventId: WEDDING_EVENT.id, rsvp: 'Declined' },
      ])
      mockCountByWeddingAndGuestEventPairs.mockResolvedValue(2)

      await service.submitPublicRsvp(
        {
          subUrl: 'ash-and-jamie',
          householdId: 'household-123',
          rsvpResponses: [
            { eventId: CHUPPAH_EVENT.id, guestId: 1, rsvp: 'Attending' },
            { eventId: WEDDING_EVENT.id, guestId: 1, rsvp: 'Declined' },
          ],
          answersToQuestions: [],
        },
        '127.0.0.1'
      )

      // An explicit wedding answer always wins - the derived decline must
      // never touch it.
      expect(mockDb.invitation.updateMany).not.toHaveBeenCalled()
    })

    it('does not re-decline a wedding invitation that a previous submission already derived', async () => {
      stubHouseholdInvitations([
        { eventId: CHUPPAH_EVENT.id, rsvp: 'Attending' },
        { eventId: WEDDING_EVENT.id, rsvp: 'Declined' },
      ])

      await service.submitPublicRsvp(
        {
          subUrl: 'ash-and-jamie',
          householdId: 'household-123',
          rsvpResponses: [{ eventId: CHUPPAH_EVENT.id, guestId: 1, rsvp: 'Attending' }],
          answersToQuestions: [],
        },
        '127.0.0.1'
      )

      // Idempotent: the wedding event is already Declined (not 'Invited'),
      // so re-submitting the chuppah-only answer must not flip it again.
      expect(mockDb.invitation.updateMany).not.toHaveBeenCalled()
    })

    it('lets an admin reset a chuppah-only household back to "not answered" on the wedding event', async () => {
      // The household previously had its wedding row derived-Declined (the
      // rule fired on an earlier guest submission). The chuppah is still
      // Attending, so if the derived rule ran again for this admin edit it
      // would immediately re-decline the row the admin just reset to
      // 'Invited', leaving the admin unable to clear the answer.
      stubHouseholdInvitations([
        { eventId: CHUPPAH_EVENT.id, rsvp: 'Attending' },
        { eventId: WEDDING_EVENT.id, rsvp: 'Invited' },
      ])

      await service.submitManagedRsvp(actorContext, 'wedding-123', {
        rsvpResponses: [{ eventId: WEDDING_EVENT.id, guestId: 1, rsvp: 'Invited' }],
        answersToQuestions: [],
      })

      expect(mockUpdate).toHaveBeenCalledWith(
        1,
        WEDDING_EVENT.id,
        expect.objectContaining({ rsvp: 'Invited' })
      )
      // The derived-decline rule is guest-originated only - a managed
      // (admin) submission must never trigger it.
      expect(mockDb.invitation.updateMany).not.toHaveBeenCalled()
    })
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
