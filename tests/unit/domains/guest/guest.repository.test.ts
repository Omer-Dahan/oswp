import { GuestRepository } from '~/server/domains/guest/guest.repository'

describe('GuestRepository.replaceTagAlongs', () => {
  const mockGuestFindMany = jest.fn()
  const mockGuestDeleteMany = jest.fn()
  const mockGuestCreate = jest.fn()
  const mockInvitationUpdateMany = jest.fn()
  const mockInvitationCreateMany = jest.fn()

  const mockDb = {
    guest: {
      findMany: mockGuestFindMany,
      deleteMany: mockGuestDeleteMany,
      create: mockGuestCreate,
    },
    invitation: {
      updateMany: mockInvitationUpdateMany,
      createMany: mockInvitationCreateMany,
    },
  }

  let repository: GuestRepository

  beforeEach(() => {
    jest.resetAllMocks()
    mockGuestFindMany.mockResolvedValue([])
    mockInvitationUpdateMany.mockResolvedValue({ count: 0 })
    mockInvitationCreateMany.mockResolvedValue({ count: 0 })
    repository = new GuestRepository(mockDb as never)
  })

  it("creates one tag-along guest per named extra, attending every rsvp'd event", async () => {
    await repository.replaceTagAlongs('household-1', 'wedding-1', ['Jamie Doe'], ['event-1'])

    expect(mockGuestCreate).toHaveBeenCalledTimes(1)
    expect(mockGuestCreate).toHaveBeenCalledWith({
      data: {
        firstName: 'Jamie',
        lastName: 'Doe',
        householdId: 'household-1',
        weddingId: 'wedding-1',
        isTagAlong: true,
        invitations: {
          createMany: {
            data: [{ eventId: 'event-1', weddingId: 'wedding-1', rsvp: 'Attending' }],
          },
        },
      },
    })
  })

  it('replaces the previous tag-along set on re-submission instead of accumulating duplicates', async () => {
    // Stand in for the household's rows in the database: deleteMany removes
    // unmatched tag-alongs, create appends new ones, so this mirrors what
    // re-submitting twice actually leaves behind.
    let householdRows: { id: number; firstName: string; lastName: string }[] = []
    let nextId = 1

    mockGuestFindMany.mockImplementation(() =>
      Promise.resolve(householdRows.map((row) => ({ ...row })))
    )
    mockGuestDeleteMany.mockImplementation(({ where }: { where: { id: { in: number[] } } }) => {
      householdRows = householdRows.filter((row) => !where.id.in.includes(row.id))
      return Promise.resolve({ count: 0 })
    })
    mockGuestCreate.mockImplementation(
      ({ data }: { data: { firstName: string; lastName: string } }) => {
        householdRows.push({ id: nextId++, firstName: data.firstName, lastName: data.lastName })
        return Promise.resolve(data)
      }
    )

    await repository.replaceTagAlongs('household-1', 'wedding-1', ['Jamie Doe'], ['event-1'])
    await repository.replaceTagAlongs(
      'household-1',
      'wedding-1',
      ['Jamie Doe', 'Alex Roe'],
      ['event-1']
    )

    expect(householdRows.map(({ firstName, lastName }) => ({ firstName, lastName }))).toEqual([
      { firstName: 'Jamie', lastName: 'Doe' },
      { firstName: 'Alex', lastName: 'Roe' },
    ])
  })

  it('creates no rows and skips invitations when there are no named extras', async () => {
    await repository.replaceTagAlongs('household-1', 'wedding-1', [], ['event-1'])

    expect(mockGuestCreate).not.toHaveBeenCalled()
  })

  it('keeps an existing tag-along Attending for an event the household attends, and never touches a Not Invited row', async () => {
    // A household pair where one guest attends event-1 and the other
    // doesn't: the tag-along already exists, Attending on event-1, and was
    // explicitly marked Not Invited on event-2 (an event only one guest of
    // the pair is invited to).
    mockGuestFindMany.mockResolvedValue([{ id: 1, firstName: 'Jamie', lastName: 'Doe' }])

    await repository.replaceTagAlongs(
      'household-1',
      'wedding-1',
      ['Jamie Doe'],
      ['event-1'],
      ['event-2']
    )

    expect(mockInvitationUpdateMany).toHaveBeenCalledWith({
      where: {
        guestId: { in: [1] },
        eventId: { in: ['event-1'] },
        rsvp: { not: 'Not Invited' },
      },
      data: { rsvp: 'Attending' },
    })
    expect(mockInvitationUpdateMany).toHaveBeenCalledWith({
      where: {
        guestId: { in: [1] },
        eventId: { in: ['event-2'] },
        rsvp: { not: 'Not Invited' },
      },
      data: { rsvp: 'Declined' },
    })
  })
})
