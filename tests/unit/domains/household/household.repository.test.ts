import { Prisma } from '@prisma/client'
import { HouseholdRepository } from '~/server/domains/household/household.repository'

describe('HouseholdRepository.search', () => {
  const mockHouseholdFindMany = jest.fn()

  const mockDb = {
    household: {
      findMany: mockHouseholdFindMany,
    },
  }

  let repository: HouseholdRepository

  beforeEach(() => {
    jest.resetAllMocks()
    mockHouseholdFindMany.mockResolvedValue([])
    repository = new HouseholdRepository(mockDb as never)
  })

  const whereOf = () => mockHouseholdFindMany.mock.calls[0]?.[0]?.where

  it('scopes the search to the wedding and only invited households', async () => {
    await repository.search('Betum', 'wedding-1')

    const where = whereOf()
    expect(where.weddingId).toBe('wedding-1')
    // Households must have at least one guest with an actionable invitation.
    expect(where.guests).toEqual({
      some: {
        invitations: { some: { rsvp: { in: ['Invited', 'Attending', 'Declined'] } } },
      },
    })
  })

  it('matches a single term against first or last name, case-insensitively', async () => {
    await repository.search('Betum', 'wedding-1')

    expect(whereOf().AND).toEqual([
      {
        guests: {
          some: {
            OR: [
              { firstName: { contains: 'Betum', mode: 'insensitive' } },
              { lastName: { contains: 'Betum', mode: 'insensitive' } },
            ],
          },
        },
      },
    ])
  })

  it('requires every whitespace-separated term to match, so a full name works', async () => {
    // The RSVP "Full Name" field leads guests to type first + last together.
    // First/last names live in separate columns, so each term matches
    // independently and all terms must be satisfied by the household.
    await repository.search('Betum Adobo', 'wedding-1')

    const and = whereOf().AND
    expect(and).toHaveLength(2)
    expect(and[0].guests.some.OR).toEqual([
      { firstName: { contains: 'Betum', mode: 'insensitive' } },
      { lastName: { contains: 'Betum', mode: 'insensitive' } },
    ])
    expect(and[1].guests.some.OR).toEqual([
      { firstName: { contains: 'Adobo', mode: 'insensitive' } },
      { lastName: { contains: 'Adobo', mode: 'insensitive' } },
    ])
  })

  it('collapses extra whitespace between terms', async () => {
    await repository.search('  Betum   Adobo  ', 'wedding-1')

    expect(whereOf().AND).toHaveLength(2)
  })

  it('returns nothing without hitting the database for a blank search', async () => {
    const result = await repository.search('   ', 'wedding-1')

    expect(result).toEqual([])
    expect(mockHouseholdFindMany).not.toHaveBeenCalled()
  })
})

describe('HouseholdRepository.searchPublicByName', () => {
  const mockQueryRaw = jest.fn()
  const mockHouseholdFindMany = jest.fn()

  const mockDb = {
    $queryRaw: mockQueryRaw,
    household: {
      findMany: mockHouseholdFindMany,
    },
  }

  let repository: HouseholdRepository

  const guest = (firstName: string, lastName: string) => ({
    firstName,
    lastName,
    invitations: [],
    guestTagAssignments: [],
  })

  const household = (id: string, ...guests: ReturnType<typeof guest>[]) => ({ id, guests })

  const HOUSEHOLDS = [
    household('h-sarah-smith', guest('Sarah', 'Smith')),
    household('h-sarah-jones', guest('Sarah', 'Jones')),
    household('h-sarah-jane', guest('Sarah-Jane', 'Baker')),
    household('h-obrien', guest("O'Brien", 'Murphy')),
    household('h-jackie', guest("ג'קי", 'כהן')),
    // Two members whose names each match one term of "Papa Baby".
    household('h-bears', guest('Papa', 'Bear'), guest('Baby', 'Bear')),
    // A guest registered with no last name — their own stored name is a
    // single token, so a single search term must be able to find them.
    household('h-cher', guest('Cher', '')),
  ]

  beforeEach(() => {
    jest.resetAllMocks()
    // The DB-level candidate filter is real Postgres SQL (see normalizedNameSql
    // in the repository) that a unit test can't execute, so the mock stands in
    // as a superset: every household is a "candidate" and the real, unmocked
    // in-memory filter below (which uses the actual tokenizeNameForSearch) does
    // the matching these tests assert on. The DB scoping itself (weddingId,
    // invited-only) is asserted separately against the real SQL values below.
    mockQueryRaw.mockResolvedValue(HOUSEHOLDS.map((h) => ({ id: h.id })))
    mockHouseholdFindMany.mockImplementation(
      async ({ where }: { where: { id: { in: string[] } } }) =>
        HOUSEHOLDS.filter((h) => where.id.in.includes(h.id))
    )
    repository = new HouseholdRepository(mockDb as never)
  })

  const idsFor = async (searchText: string) =>
    (await repository.searchPublicByName(searchText, 'wedding-1')).map((h) => h.id)

  it('scopes the query to the wedding and to invited households', async () => {
    await repository.searchPublicByName('Sarah Smith', 'wedding-1')

    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    const query = mockQueryRaw.mock.calls[0]?.[0] as Prisma.Sql
    // weddingId is the first interpolated value, scoping the household lookup.
    expect(query.values[0]).toBe('wedding-1')
    expect(query.sql).toContain('"Household"."weddingId" = ?')
    // Only households with a guest holding an actionable invitation qualify.
    expect(query.sql).toContain(`i."rsvp" IN ('Invited', 'Attending', 'Declined')`)
  })

  it('returns nothing for a single term that only matches multi-token guests', async () => {
    expect(await idsFor('Sarah')).toEqual([])
  })

  it('matches a single-name guest (no last name on file) by their one name', async () => {
    expect(await idsFor('Cher')).toEqual(['h-cher'])
  })

  it('returns nothing without querying for an empty search string', async () => {
    const result = await repository.searchPublicByName('   ', 'wedding-1')

    expect(result).toEqual([])
    expect(mockQueryRaw).not.toHaveBeenCalled()
    expect(mockHouseholdFindMany).not.toHaveBeenCalled()
  })

  it('does not query findMany when no candidates match at the DB level', async () => {
    mockQueryRaw.mockResolvedValue([])

    const result = await repository.searchPublicByName('Sarah Smith', 'wedding-1')

    expect(result).toEqual([])
    expect(mockHouseholdFindMany).not.toHaveBeenCalled()
  })

  it('requires first and last name, so a common first name no longer matches everyone', async () => {
    // "Sarah" alone is rejected above; "Sarah Smith" pins one household.
    expect(await idsFor('Sarah Smith')).toEqual(['h-sarah-smith'])
  })

  it('requires all terms to match the SAME guest, not different household members', async () => {
    // "Papa Baby" would match the Bears household if terms could spread across
    // members; matched against a single guest it should find no one.
    expect(await idsFor('Papa Baby')).toEqual([])
    expect(await idsFor('Papa Bear')).toEqual(['h-bears'])
  })

  it('treats hyphens and spaces interchangeably', async () => {
    expect(await idsFor('Sarah Jane Baker')).toEqual(['h-sarah-jane'])
    expect(await idsFor('Sarah-Jane Baker')).toEqual(['h-sarah-jane'])
  })

  it('ignores apostrophes when matching, in both directions', async () => {
    expect(await idsFor('OBrien Murphy')).toEqual(['h-obrien'])
    expect(await idsFor("O'Brien Murphy")).toEqual(['h-obrien'])
  })

  it('ignores Hebrew geresh, gershayim, and straight double quotes when matching', async () => {
    expect(await idsFor('O׳Brien Murphy')).toEqual(['h-obrien'])
    expect(await idsFor('O״Brien Murphy')).toEqual(['h-obrien'])
    expect(await idsFor('O"Brien Murphy')).toEqual(['h-obrien'])
  })

  it('finds a Hebrew name stored with a geresh, searched with or without it', async () => {
    expect(await idsFor("ג'קי כהן")).toEqual(['h-jackie'])
    expect(await idsFor('גקי כהן')).toEqual(['h-jackie'])
  })

  it('stays case-tolerant', async () => {
    // Multi-term matches require a full token match (see the in-memory
    // filter's hasFullTokenMatch check), so only casing varies here — a
    // genuinely partial term like "sar" would clear the DB-level candidate
    // filter but then be rejected by that exact-token check.
    expect(await idsFor('SARAH SMITH')).toEqual(['h-sarah-smith'])
    expect(await idsFor('sArAh sMiTh')).toEqual(['h-sarah-smith'])
  })

  it('returns nothing when no single guest matches every term', async () => {
    expect(await idsFor('Sarah Nonexistent')).toEqual([])
  })
})
