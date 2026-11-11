import { TRPCError } from '@trpc/server'

jest.mock('~/server/authz/permission-checker', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('~/server/domains/seating/seating.repository')

import { requirePermission } from '~/server/authz/permission-checker'
import {
  SeatAlreadyTakenError,
  SeatingTableNotFoundError,
} from '~/server/domains/seating/seating.errors'

// @ts-expect-error - Importing mock functions from mocked module
import {
  buildSeatableGuest,
  mockCreateAutoSeating,
  mockCreateTable,
  mockDeleteAssignments,
  mockDeleteTable,
  mockEventBelongsToWedding,
  mockFindAutoSeatGuests,
  mockFindSeatableGuestIds,
  mockFindSeatableGuests,
  mockFindSeatWeights,
  mockFindTableById,
  mockFindTablesByEventId,
  mockFindWeddingEvents,
  mockLockedCreateAssignments,
  mockLockedReplaceAssignments,
  mockLockedSeatedGuestIds,
  mockLockedTableRow,
  mockLockedUpdateTable,
  mockTable,
  mockWithLockedTable,
  resetMocks,
  SeatingRepository,
} from '~/server/domains/seating/seating.repository'
import { SeatingService } from '~/server/domains/seating/seating.service'

const mockRequirePermission = requirePermission as jest.Mock
const WEDDING_ID = 'wedding-123'

describe('SeatingService', () => {
  let service: SeatingService
  const ctx = {
    userId: 'actor-1',
    activeOrganization: { organizationId: 'org-1', role: 'owner' },
  }

  beforeEach(() => {
    resetMocks()
    mockRequirePermission.mockReset()
    ;(mockEventBelongsToWedding as jest.Mock).mockResolvedValue(true)
    ;(mockFindTableById as jest.Mock).mockResolvedValue(mockTable)
    service = new SeatingService(new SeatingRepository())
  })

  describe('getChart', () => {
    it('requires event read permission', async () => {
      ;(mockFindTablesByEventId as jest.Mock).mockResolvedValue([])
      ;(mockFindSeatableGuests as jest.Mock).mockResolvedValue([])

      await service.getChart(ctx, WEDDING_ID, 'event-1')

      expect(mockRequirePermission).toHaveBeenCalledWith(ctx, { event: ['read'], guest: ['read'] })
    })

    it('rejects events outside the active wedding', async () => {
      ;(mockEventBelongsToWedding as jest.Mock).mockResolvedValue(false)

      await expect(service.getChart(ctx, WEDDING_ID, 'event-x')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
    })

    it('returns tables with guest ids and guests grouped by household', async () => {
      ;(mockFindTablesByEventId as jest.Mock).mockResolvedValue([mockTable])
      ;(mockFindSeatableGuests as jest.Mock).mockResolvedValue([
        buildSeatableGuest({ id: 1, lastName: 'Zed', seatAssignments: [{ tableId: 'table-1' }] }),
        buildSeatableGuest({
          id: 2,
          lastName: 'Zed',
          isPrimaryContact: true,
          seatAssignments: [{ tableId: 'table-1' }],
          guestTagAssignments: [{ guestTag: { name: 'Family' } }],
        }),
        buildSeatableGuest({
          id: 3,
          lastName: 'Abbot',
          householdId: 'household-2',
          household: {
            id: 'household-2',
            address1: '1 Main St',
            address2: null,
            city: 'Austin',
            state: 'TX',
            zipCode: '78701',
            country: null,
            notes: 'Bringing a gift',
          },
        }),
      ])

      const chart = await service.getChart(ctx, WEDDING_ID, 'event-1')

      expect(chart.tables).toEqual([
        {
          id: 'table-1',
          name: 'Table 1',
          shape: 'ROUND',
          capacity: 4,
          positionX: 40,
          positionY: 40,
          guestIds: [1, 2],
        },
      ])
      // Households sorted by their primary contact's last name
      expect(chart.households.map((h) => h.id)).toEqual(['household-2', 'household-1'])
      expect(chart.households[0]).toMatchObject({
        address: '1 Main St, Austin, TX 78701',
        notes: 'Bringing a gift',
      })
      // Primary contact first within a household
      expect(chart.households[1]?.guests.map((g) => g.id)).toEqual([2, 1])
      expect(chart.households[1]?.guests[0]).toMatchObject({
        tableId: 'table-1',
        tags: ['Family'],
        rsvp: 'Attending',
      })
      expect(chart.households[0]?.guests[0]?.tableId).toBeNull()
    })

    it('exposes a household\'s named extra guests as seatable people alongside its named guests', async () => {
      ;(mockFindTablesByEventId as jest.Mock).mockResolvedValue([])
      ;(mockFindSeatableGuests as jest.Mock).mockResolvedValue([
        buildSeatableGuest({ id: 1, householdId: 'household-1', isPrimaryContact: true }),
        buildSeatableGuest({ id: 2, householdId: 'household-1' }),
        buildSeatableGuest({ id: 3, householdId: 'household-1', isTagAlong: true }),
        buildSeatableGuest({ id: 4, householdId: 'household-1', isTagAlong: true }),
      ])

      const chart = await service.getChart(ctx, WEDDING_ID, 'event-1')

      expect(chart.households).toHaveLength(1)
      expect(chart.households[0]?.guests).toHaveLength(4)
      expect(chart.households[0]?.guests.filter((g) => g.isTagAlong).map((g) => g.id)).toEqual([
        3, 4,
      ])
    })
  })

  describe('createTable', () => {
    it('creates a table on an event in the wedding', async () => {
      ;(mockCreateTable as jest.Mock).mockResolvedValue(mockTable)

      await service.createTable(ctx, WEDDING_ID, {
        eventId: 'event-1',
        name: 'Table 1',
        shape: 'RECTANGULAR',
        capacity: 8,
        positionX: 10,
        positionY: 20,
      })

      expect(mockRequirePermission).toHaveBeenCalledWith(ctx, { event: ['update'] })
      expect(mockCreateTable).toHaveBeenCalledWith({
        weddingId: WEDDING_ID,
        eventId: 'event-1',
        name: 'Table 1',
        shape: 'RECTANGULAR',
        capacity: 8,
        positionX: 10,
        positionY: 20,
      })
    })

    it('rejects events outside the active wedding', async () => {
      ;(mockEventBelongsToWedding as jest.Mock).mockResolvedValue(false)

      await expect(
        service.createTable(ctx, WEDDING_ID, {
          eventId: 'event-x',
          name: 'T',
          shape: 'ROUND',
          capacity: 8,
          positionX: 0,
          positionY: 0,
        })
      ).rejects.toBeInstanceOf(TRPCError)
      expect(mockCreateTable).not.toHaveBeenCalled()
    })

    it('rejects a table created with a non-wedding eventId', async () => {
      mockFindWeddingEvents.mockResolvedValue([
        { id: 'event-1', name: 'חתונה', isPrimary: false, collectRsvp: true },
        { id: 'event-chuppah', name: 'חופה', isPrimary: true, collectRsvp: true },
      ])

      await expect(
        service.createTable(ctx, WEDDING_ID, {
          eventId: 'event-chuppah',
          name: 'T',
          shape: 'ROUND',
          capacity: 8,
          positionX: 0,
          positionY: 0,
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      expect(mockCreateTable).not.toHaveBeenCalled()
    })
  })

  describe('updateTable', () => {
    it('renames, reshapes and moves a table', async () => {
      await service.updateTable(ctx, WEDDING_ID, 'table-1', {
        name: 'Head Table',
        shape: 'RECTANGULAR',
        positionX: 300,
        positionY: 120,
      })

      expect(mockLockedUpdateTable).toHaveBeenCalledWith({
        name: 'Head Table',
        shape: 'RECTANGULAR',
        positionX: 300,
        positionY: 120,
      })
    })

    it('sends position-only moves through the lock too', async () => {
      await service.updateTable(ctx, WEDDING_ID, 'table-1', { positionX: 5, positionY: 6 })

      expect(mockLockedUpdateTable).toHaveBeenCalledWith({ positionX: 5, positionY: 6 })
    })

    it('reports a table deleted by someone else as NOT_FOUND', async () => {
      ;(mockWithLockedTable as jest.Mock).mockRejectedValue(new SeatingTableNotFoundError())

      await expect(
        service.updateTable(ctx, WEDDING_ID, 'table-1', { positionX: 5 })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('rejects shrinking capacity below the number of seated guests', async () => {
      ;(mockLockedSeatedGuestIds as jest.Mock).mockResolvedValue([1, 2])

      await expect(
        service.updateTable(ctx, WEDDING_ID, 'table-1', { capacity: 1 })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
      expect(mockLockedUpdateTable).not.toHaveBeenCalled()
    })

    it('checks and changes capacity inside the locked table transaction', async () => {
      ;(mockLockedSeatedGuestIds as jest.Mock).mockResolvedValue([1])

      await service.updateTable(ctx, WEDDING_ID, 'table-1', { capacity: 2 })

      expect(mockWithLockedTable).toHaveBeenCalledWith(
        { id: 'table-1', eventId: 'event-1' },
        expect.any(Function)
      )
      expect(mockLockedUpdateTable).toHaveBeenCalledWith({ capacity: 2 })
    })

    it('rejects tables from another wedding', async () => {
      ;(mockFindTableById as jest.Mock).mockResolvedValue({ ...mockTable, weddingId: 'other' })

      await expect(
        service.updateTable(ctx, WEDDING_ID, 'table-1', { name: 'X' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('rejects missing tables', async () => {
      ;(mockFindTableById as jest.Mock).mockResolvedValue(null)

      await expect(
        service.updateTable(ctx, WEDDING_ID, 'missing', { name: 'X' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  describe('deleteTable', () => {
    it('deletes a table in the wedding', async () => {
      await service.deleteTable(ctx, WEDDING_ID, 'table-1')

      expect(mockDeleteTable).toHaveBeenCalledWith('table-1')
    })

    it('rejects tables from another wedding', async () => {
      ;(mockFindTableById as jest.Mock).mockResolvedValue({ ...mockTable, weddingId: 'other' })

      await expect(service.deleteTable(ctx, WEDDING_ID, 'table-1')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
      expect(mockDeleteTable).not.toHaveBeenCalled()
    })
  })

  describe('assignGuests', () => {
    beforeEach(() => {
      ;(mockLockedSeatedGuestIds as jest.Mock).mockResolvedValue([1, 2])
    })

    it('seats guests at a table with room, inside the locked table transaction', async () => {
      ;(mockFindSeatableGuestIds as jest.Mock).mockResolvedValue([3, 4])

      await service.assignGuests(ctx, WEDDING_ID, { tableId: 'table-1', guestIds: [3, 4] })

      expect(mockFindSeatableGuestIds).toHaveBeenCalledWith('event-1', [3, 4])
      expect(mockWithLockedTable).toHaveBeenCalledWith(
        { id: 'table-1', eventId: 'event-1' },
        expect.any(Function)
      )
      expect(mockLockedReplaceAssignments).toHaveBeenCalledWith([3, 4])
    })

    it('counts capacity from the locked seat list, not the earlier snapshot', async () => {
      // Snapshot says 2 seated, but another planner filled the table meanwhile
      ;(mockLockedSeatedGuestIds as jest.Mock).mockResolvedValue([1, 2, 5, 6])
      ;(mockFindSeatableGuestIds as jest.Mock).mockResolvedValue([3])

      await expect(
        service.assignGuests(ctx, WEDDING_ID, { tableId: 'table-1', guestIds: [3] })
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'בשולחן Table 1 נשארו 0 מקומות פנויים',
      })
      expect(mockLockedReplaceAssignments).not.toHaveBeenCalled()
    })

    it('checks against the capacity read under the lock, not the earlier snapshot', async () => {
      // Snapshot (mockTable) says capacity 4; another planner lowered it to 2 meanwhile
      mockLockedTableRow.capacity = 2
      ;(mockFindSeatableGuestIds as jest.Mock).mockResolvedValue([3])

      await expect(
        service.assignGuests(ctx, WEDDING_ID, { tableId: 'table-1', guestIds: [3] })
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'בשולחן Table 1 נשארו 0 מקומות פנויים',
      })
      expect(mockLockedReplaceAssignments).not.toHaveBeenCalled()
      mockLockedTableRow.capacity = 4
    })

    it('reports a table deleted by someone else as NOT_FOUND', async () => {
      ;(mockFindSeatableGuestIds as jest.Mock).mockResolvedValue([3])
      ;(mockWithLockedTable as jest.Mock).mockRejectedValue(new SeatingTableNotFoundError())

      await expect(
        service.assignGuests(ctx, WEDDING_ID, { tableId: 'table-1', guestIds: [3] })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('blocks a drop that would exceed capacity', async () => {
      ;(mockFindSeatableGuestIds as jest.Mock).mockResolvedValue([3, 4, 5])

      await expect(
        service.assignGuests(ctx, WEDDING_ID, { tableId: 'table-1', guestIds: [3, 4, 5] })
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'בשולחן Table 1 נשארו 2 מקומות פנויים',
      })
      expect(mockLockedReplaceAssignments).not.toHaveBeenCalled()
    })

    it('fills the rest of a table when part of a household is already there', async () => {
      ;(mockLockedSeatedGuestIds as jest.Mock).mockResolvedValue([1, 2, 3])
      ;(mockFindSeatableGuestIds as jest.Mock).mockResolvedValue([3, 4])

      await service.assignGuests(ctx, WEDDING_ID, { tableId: 'table-1', guestIds: [3, 4] })

      expect(mockLockedReplaceAssignments).toHaveBeenCalledWith([3, 4])
    })

    it('rejects guests who are not seatable for the event', async () => {
      ;(mockFindSeatableGuestIds as jest.Mock).mockResolvedValue([3])

      await expect(
        service.assignGuests(ctx, WEDDING_ID, { tableId: 'table-1', guestIds: [3, 99] })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
      expect(mockWithLockedTable).not.toHaveBeenCalled()
    })

    it('rejects tables from another wedding', async () => {
      ;(mockFindTableById as jest.Mock).mockResolvedValue({ ...mockTable, weddingId: 'other' })

      await expect(
        service.assignGuests(ctx, WEDDING_ID, { tableId: 'table-1', guestIds: [3] })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      expect(mockFindSeatableGuestIds).not.toHaveBeenCalled()
    })

    it('turns a concurrent duplicate seat into a CONFLICT error', async () => {
      ;(mockFindSeatableGuestIds as jest.Mock).mockResolvedValue([3])
      ;(mockLockedReplaceAssignments as jest.Mock).mockRejectedValue(new SeatAlreadyTakenError())

      await expect(
        service.assignGuests(ctx, WEDDING_ID, { tableId: 'table-1', guestIds: [3] })
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })
  })

  describe('unassignGuests', () => {
    it('removes guests from their tables for the event', async () => {
      await service.unassignGuests(ctx, WEDDING_ID, { eventId: 'event-1', guestIds: [1] })

      expect(mockDeleteAssignments).toHaveBeenCalledWith('event-1', [1])
    })

    it('rejects events outside the active wedding', async () => {
      ;(mockEventBelongsToWedding as jest.Mock).mockResolvedValue(false)

      await expect(
        service.unassignGuests(ctx, WEDDING_ID, { eventId: 'event-x', guestIds: [1] })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  describe('autoSeat', () => {
    beforeEach(() => {
      mockFindWeddingEvents.mockResolvedValue([
        { id: 'event-1', name: 'חתונה', isPrimary: false, collectRsvp: true },
        { id: 'event-chuppah', name: 'חופה', isPrimary: true, collectRsvp: true },
      ])
      ;(mockFindTablesByEventId as jest.Mock).mockResolvedValue([])
    })

    it('rejects a non-wedding eventId', async () => {
      await expect(
        service.autoSeat(ctx, WEDDING_ID, {
          eventId: 'event-chuppah',
          fillFreeSeatsOnly: true,
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      expect(mockFindAutoSeatGuests).not.toHaveBeenCalled()
    })

    it('skips guests who did not confirm the wedding event', async () => {
      // Guest 1 has an invitation to the wedding event (seatable). Guest 2 only
      // ever confirmed the chuppah, so a query scoped to the wedding event never
      // returns an invitation row for them at all - this is what the repository
      // enforces for real; here the mock stands in for that per-event scoping.
      mockFindAutoSeatGuests.mockImplementation((eventId: string) =>
        Promise.resolve(
          eventId === 'event-1'
            ? [
                {
                  rsvp: 'Attending',
                  guest: {
                    id: 1,
                    isPrimaryContact: true,
                    householdId: 'household-1',
                    household: { id: 'household-1', side: null, groupName: null, attendingCount: 1 },
                    seatAssignments: [],
                  },
                },
              ]
            : []
        )
      )
      ;(mockFindTablesByEventId as jest.Mock).mockResolvedValue([
        {
          id: 'table-1',
          weddingId: WEDDING_ID,
          eventId: 'event-1',
          name: 'Table 1',
          shape: 'ROUND',
          capacity: 4,
          positionX: 0,
          positionY: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          seatAssignments: [],
        },
      ])

      const result = await service.autoSeat(ctx, WEDDING_ID, {
        eventId: 'event-1',
        fillFreeSeatsOnly: true,
      })

      expect(mockFindAutoSeatGuests).toHaveBeenCalledWith('event-1')
      expect(result).toEqual({ seated: 1, createdTables: 0, unseated: 0 })
      expect(mockCreateAutoSeating).toHaveBeenCalledWith(
        'event-1',
        expect.arrayContaining([expect.objectContaining({ guestId: 1, tableId: 'table-1' })])
      )
    })

    it('never invents a table: a household that fits nowhere existing is unseated', async () => {
      mockFindAutoSeatGuests.mockResolvedValue([
        {
          rsvp: 'Attending',
          guest: {
            id: 1,
            isPrimaryContact: true,
            householdId: 'household-1',
            household: { id: 'household-1', side: null, groupName: null, attendingCount: 1 },
            seatAssignments: [],
          },
        },
      ])
      // No existing tables at all - the planner must never open one itself.
      ;(mockFindTablesByEventId as jest.Mock).mockResolvedValue([])

      const result = await service.autoSeat(ctx, WEDDING_ID, {
        eventId: 'event-1',
        fillFreeSeatsOnly: true,
      })

      expect(result).toEqual({ seated: 0, createdTables: 0, unseated: 1 })
      expect(mockCreateAutoSeating).not.toHaveBeenCalled()
    })
  })

  const buildInvitation = (
    guestId: number,
    household: { id: string; side: string | null; groupName: string | null },
    options: { rsvp?: string; seated?: boolean; isPrimaryContact?: boolean } = {}
  ) => ({
    rsvp: options.rsvp ?? 'Attending',
    guest: {
      id: guestId,
      isPrimaryContact: options.isPrimaryContact ?? true,
      householdId: household.id,
      household: { ...household, attendingCount: 1 },
      seatAssignments: options.seated ? [{ tableId: 'table-1' }] : [],
    },
  })

  describe('getGroups', () => {
    beforeEach(() => {
      mockFindWeddingEvents.mockResolvedValue([
        { id: 'event-1', name: 'חתונה', isPrimary: false, collectRsvp: true },
        { id: 'event-chuppah', name: 'חופה', isPrimary: true, collectRsvp: true },
      ])
      mockFindSeatWeights.mockResolvedValue(new Map())
    })

    it('splits households into assigned and unassigned per side+group, skipping declined households', async () => {
      mockFindAutoSeatGuests.mockResolvedValue([
        buildInvitation(1, { id: 'h-1', side: 'כלה', groupName: 'משפחה' }, { seated: true }),
        buildInvitation(2, { id: 'h-2', side: 'כלה', groupName: 'משפחה' }, { seated: false }),
        buildInvitation(3, { id: 'h-3', side: 'חתן', groupName: 'חברים' }, { rsvp: 'Declined' }),
      ])

      const groups = await service.getGroups(ctx, WEDDING_ID, 'event-1')

      expect(mockRequirePermission).toHaveBeenCalledWith(ctx, { event: ['read'] })
      expect(groups).toEqual([
        {
          side: 'כלה',
          groupName: 'משפחה',
          assignedHouseholds: 1,
          unassignedHouseholds: 1,
          seatsNeeded: 1,
        },
      ])
    })

    it('rejects a non-wedding eventId', async () => {
      await expect(service.getGroups(ctx, WEDDING_ID, 'event-chuppah')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
      expect(mockFindAutoSeatGuests).not.toHaveBeenCalled()
    })
  })

  describe('suggestForGroup', () => {
    beforeEach(() => {
      mockFindWeddingEvents.mockResolvedValue([
        { id: 'event-1', name: 'חתונה', isPrimary: false, collectRsvp: true },
        { id: 'event-chuppah', name: 'חופה', isPrimary: true, collectRsvp: true },
      ])
      mockFindSeatWeights.mockResolvedValue(new Map())
    })

    it('ranks up to three existing tables with a non-empty reason', async () => {
      mockFindAutoSeatGuests.mockResolvedValue([
        buildInvitation(1, { id: 'h-1', side: 'כלה', groupName: 'משפחה' }),
      ])
      mockFindTablesByEventId.mockResolvedValue([
        {
          id: 'table-1',
          weddingId: WEDDING_ID,
          eventId: 'event-1',
          name: 'שולחן 1',
          shape: 'ROUND',
          capacity: 8,
          positionX: 0,
          positionY: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          seatAssignments: [],
        },
      ])

      const suggestions = await service.suggestForGroup(ctx, WEDDING_ID, {
        eventId: 'event-1',
        side: 'כלה',
        groupName: 'משפחה',
      })

      expect(mockRequirePermission).toHaveBeenCalledWith(ctx, { event: ['read'] })
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.length).toBeLessThanOrEqual(3)
      for (const suggestion of suggestions) {
        expect(suggestion.reason.length).toBeGreaterThan(0)
        expect(suggestion).toMatchObject({ tableId: 'table-1', tableName: 'שולחן 1' })
      }
    })

    it('returns nothing when the group has no unseated households', async () => {
      mockFindAutoSeatGuests.mockResolvedValue([
        buildInvitation(1, { id: 'h-1', side: 'כלה', groupName: 'משפחה' }, { seated: true }),
      ])
      mockFindTablesByEventId.mockResolvedValue([])

      const suggestions = await service.suggestForGroup(ctx, WEDDING_ID, {
        eventId: 'event-1',
        side: 'כלה',
        groupName: 'משפחה',
      })

      expect(suggestions).toEqual([])
    })
  })

  describe('applyGroupPlacement', () => {
    beforeEach(() => {
      mockFindWeddingEvents.mockResolvedValue([
        { id: 'event-1', name: 'חתונה', isPrimary: false, collectRsvp: true },
      ])
      mockFindSeatWeights.mockResolvedValue(new Map())
      mockLockedSeatedGuestIds.mockResolvedValue([])
    })

    it('seats every eligible guest of the households, skipping declined and already-seated guests', async () => {
      mockFindAutoSeatGuests.mockResolvedValue([
        buildInvitation(1, { id: 'h-1', side: 'כלה', groupName: 'משפחה' }),
        buildInvitation(2, { id: 'h-1', side: 'כלה', groupName: 'משפחה' }, { seated: true }),
        buildInvitation(3, { id: 'h-1', side: 'כלה', groupName: 'משפחה' }, { rsvp: 'Declined' }),
      ])
      mockLockedCreateAssignments.mockResolvedValue(['assignment-1'])

      const result = await service.applyGroupPlacement(ctx, WEDDING_ID, {
        eventId: 'event-1',
        tableId: 'table-1',
        householdIds: ['h-1'],
      })

      expect(mockRequirePermission).toHaveBeenCalledWith(ctx, { event: ['update'] })
      expect(mockLockedCreateAssignments).toHaveBeenCalledWith([1])
      expect(result).toEqual({ assignmentIds: ['assignment-1'] })
    })

    it('fails with BAD_REQUEST when the table does not have enough free seats', async () => {
      mockFindAutoSeatGuests.mockResolvedValue([
        buildInvitation(1, { id: 'h-1', side: 'כלה', groupName: 'משפחה' }),
        buildInvitation(2, { id: 'h-1', side: 'כלה', groupName: 'משפחה' }),
      ])
      mockLockedSeatedGuestIds.mockResolvedValue([10, 11, 12])
      mockLockedTableRow.capacity = 4

      await expect(
        service.applyGroupPlacement(ctx, WEDDING_ID, {
          eventId: 'event-1',
          tableId: 'table-1',
          householdIds: ['h-1'],
        })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
      expect(mockLockedCreateAssignments).not.toHaveBeenCalled()
      mockLockedTableRow.capacity = 4
    })
  })
})
