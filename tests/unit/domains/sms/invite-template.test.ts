import { resolveInviteMessage } from '~/server/domains/sms/invite-template'

function household(side: string | null) {
  return {
    id: 'household-1',
    side,
    guests: [{ firstName: 'דוד יעקב', lastName: 'כהן' }],
  }
}

function setup() {
  const db = {
    household: { findFirst: jest.fn() },
    inviteMessageTemplate: { findFirst: jest.fn() },
    wedding: { findUniqueOrThrow: jest.fn() },
  }
  const householdInviteService = {
    ensureInviteCode: jest.fn().mockResolvedValue('ab-123'),
  }
  return { db, householdInviteService }
}

const inviteLink = 'https://david-and-morasha.duckdns.org/w/guests/save-the-date/ab-123'

describe('resolveInviteMessage', () => {
  it('uses the bride template and signature for a bride-side household', async () => {
    const { db, householdInviteService } = setup()
    db.household.findFirst.mockResolvedValue(household('כלה'))
    db.inviteMessageTemplate.findFirst
      .mockResolvedValueOnce({
        body: '{שם}, שלום רב.\n{קישור}',
        signature: 'משה ומירב בן הרוש',
      })
      .mockResolvedValueOnce(null)

    const result = await resolveInviteMessage(
      db as never,
      householdInviteService as never,
      'wedding-1',
      'household-1'
    )

    expect(result).toMatchObject({ side: 'כלה', source: 'side', signature: 'משה ומירב בן הרוש' })
    expect(result.message).toBe(`יעקב כהן, שלום רב.\n${inviteLink}\n\nבברכה - משה ומירב בן הרוש`)
  })

  it('uses the groom template and signature for a groom-side household', async () => {
    const { db, householdInviteService } = setup()
    db.household.findFirst.mockResolvedValue(household('חתן'))
    db.inviteMessageTemplate.findFirst
      .mockResolvedValueOnce({
        body: '{שם}, שלום רב.\n{קישור}',
        signature: 'יהודה ותמר מנחם',
      })
      .mockResolvedValueOnce(null)

    const result = await resolveInviteMessage(
      db as never,
      householdInviteService as never,
      'wedding-1',
      'household-1'
    )

    expect(result).toMatchObject({ side: 'חתן', source: 'side', signature: 'יהודה ותמר מנחם' })
    expect(result.message).toBe(`יעקב כהן, שלום רב.\n${inviteLink}\n\nבברכה - יהודה ותמר מנחם`)
  })

  it('falls back to the default template with no signature when the household has no side', async () => {
    const { db, householdInviteService } = setup()
    db.household.findFirst.mockResolvedValue(household(null))
    db.inviteMessageTemplate.findFirst.mockResolvedValueOnce({
      body: '{שם}, שלום רב.\n{קישור}',
      signature: null,
    })

    const result = await resolveInviteMessage(
      db as never,
      householdInviteService as never,
      'wedding-1',
      'household-1'
    )

    expect(db.inviteMessageTemplate.findFirst).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ side: null, source: 'default', signature: null })
    expect(result.message).toBe(`יעקב כהן, שלום רב.\n${inviteLink}`)
    expect(result.message).not.toContain('בברכה')
  })

  it('falls back to the default row, never the other side, for an unrecognized side value', async () => {
    const { db, householdInviteService } = setup()
    db.household.findFirst.mockResolvedValue(household('  '))
    db.inviteMessageTemplate.findFirst.mockResolvedValueOnce({
      body: '{שם}, שלום רב.\n{קישור}',
      signature: null,
    })

    const result = await resolveInviteMessage(
      db as never,
      householdInviteService as never,
      'wedding-1',
      'household-1'
    )

    expect(result.side).toBeNull()
    expect(result.source).toBe('default')
    expect(result.signature).toBeNull()
  })

  it('prefers a stored template over the code-level default when no rows exist', async () => {
    const { db, householdInviteService } = setup()
    db.household.findFirst.mockResolvedValue(household('חתן'))
    db.inviteMessageTemplate.findFirst.mockResolvedValue(null)
    db.wedding.findUniqueOrThrow.mockResolvedValue({
      smsInviteTemplate: 'שלום {שם}: {קישור}',
    })

    const result = await resolveInviteMessage(
      db as never,
      householdInviteService as never,
      'wedding-1',
      'household-1'
    )

    expect(result).toMatchObject({ source: 'wedding-template', signature: null })
    expect(result.message).toBe(`שלום יעקב כהן: ${inviteLink}`)
  })

  it('falls back to the built-in default when no template row or wedding template exists', async () => {
    const { db, householdInviteService } = setup()
    db.household.findFirst.mockResolvedValue(household('חתן'))
    db.inviteMessageTemplate.findFirst.mockResolvedValue(null)
    db.wedding.findUniqueOrThrow.mockResolvedValue({ smsInviteTemplate: null })

    const result = await resolveInviteMessage(
      db as never,
      householdInviteService as never,
      'wedding-1',
      'household-1'
    )

    expect(result.source).toBe('built-in-default')
    expect(result.message).toContain('יעקב כהן, שלום רב.')
  })
})
