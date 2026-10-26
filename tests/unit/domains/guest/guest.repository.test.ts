import { GuestRepository } from '~/server/domains/guest/guest.repository'

describe('GuestRepository.replaceTagAlongs', () => {
  const mockGuestDeleteMany = jest.fn()
  const mockGuestCreate = jest.fn()

  const mockDb = {
    guest: {
      deleteMany: mockGuestDeleteMany,
      create: mockGuestCreate,
    },
  }

  let repository: GuestRepository

  beforeEach(() => {
    jest.resetAllMocks()
    repository = new GuestRepository(mockDb as never)
  })

  it('creates one tag-along guest per named extra, attending every rsvp\'d event', async () => {
    await repository.replaceTagAlongs('household-1', 'wedding-1', ['Jamie Doe'], ['event-1'])

    expect(mockGuestDeleteMany).toHaveBeenCalledWith({
      where: { householdId: 'household-1', isTagAlong: true },
    })
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
    // Stand in for the household's rows in the database: deleteMany removes the
    // tag-alongs, create appends new ones, so this mirrors what re-submitting
    // twice actually leaves behind.
    let householdRows: { firstName: string; lastName: string; isTagAlong: boolean }[] = []
    mockGuestDeleteMany.mockImplementation(() => {
      householdRows = householdRows.filter((row) => !row.isTagAlong)
      return Promise.resolve({ count: 0 })
    })
    mockGuestCreate.mockImplementation(({ data }) => {
      householdRows.push({
        firstName: data.firstName,
        lastName: data.lastName,
        isTagAlong: data.isTagAlong,
      })
      return Promise.resolve(data)
    })

    await repository.replaceTagAlongs('household-1', 'wedding-1', ['Jamie Doe'], ['event-1'])
    await repository.replaceTagAlongs(
      'household-1',
      'wedding-1',
      ['Jamie Doe', 'Alex Roe'],
      ['event-1']
    )

    expect(householdRows).toEqual([
      { firstName: 'Jamie', lastName: 'Doe', isTagAlong: true },
      { firstName: 'Alex', lastName: 'Roe', isTagAlong: true },
    ])
  })

  it('creates no rows and skips invitations when there are no named extras', async () => {
    await repository.replaceTagAlongs('household-1', 'wedding-1', [], ['event-1'])

    expect(mockGuestDeleteMany).toHaveBeenCalledTimes(1)
    expect(mockGuestCreate).not.toHaveBeenCalled()
  })
})
