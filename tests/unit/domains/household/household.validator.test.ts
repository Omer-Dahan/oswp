/**
 * Tests for Household Domain Validators
 */

import {
  createHouseholdManualSchema,
  createHouseholdSchema,
  deleteHouseholdSchema,
  guestPartyInputSchema,
  householdIdSchema,
  searchHouseholdSchema,
  updateHouseholdSchema,
} from '~/server/domains/household/household.validator'

describe('guestPartyInputSchema', () => {
  it('should validate a valid guest party input', () => {
    const validInput = {
      guestId: 1,
      firstName: 'John',
      lastName: 'Doe',
      invites: {
        'event-123': 'Attending',
        'event-456': 'Declined',
      },
    }

    const result = guestPartyInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('should validate guest party with email and phone', () => {
    const validInput = {
      guestId: 1,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+12025550123',
      invites: {
        'event-123': 'Attending',
      },
    }

    const result = guestPartyInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('should reject invalid email format in guest party', () => {
    const invalidInput = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'not-valid-email',
      invites: {
        'event-123': 'Invited',
      },
    }

    const result = guestPartyInputSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })

  it('should allow null email and phone', () => {
    const validInput = {
      firstName: 'John',
      lastName: 'Doe',
      email: null,
      phone: null,
      invites: {
        'event-123': 'Invited',
      },
    }

    const result = guestPartyInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('should allow guestId to be optional (for new guests)', () => {
    const validInput = {
      firstName: 'New',
      lastName: 'Guest',
      invites: {
        'event-123': 'Invited',
      },
    }

    const result = guestPartyInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('should require non-empty firstName', () => {
    const invalidInput = {
      firstName: '',
      lastName: 'Doe',
      invites: {},
    }

    const result = guestPartyInputSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })

  it('should allow empty lastName', () => {
    const validInput = {
      firstName: 'John',
      lastName: '',
      invites: {},
    }

    const result = guestPartyInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })
})

describe('createHouseholdSchema', () => {
  it('should validate a valid household creation input', () => {
    const validInput = {
      guestParty: [
        {
          firstName: 'John',
          lastName: 'Doe',
          isPrimaryContact: true,
          invites: { 'event-123': 'Invited' },
        },
      ],
      address1: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      email: 'doe@example.com',
    }

    const result = createHouseholdSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('should normalize empty household and guest emails to null', () => {
    const result = createHouseholdSchema.safeParse({
      email: '',
      guestParty: [
        {
          firstName: 'John',
          email: '',
          isPrimaryContact: true,
          invites: {},
        },
      ],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBeNull()
      expect(result.data.guestParty[0]?.email).toBeNull()
    }
  })

  it('should require at least one guest in guestParty', () => {
    const validInput = {
      guestParty: [],
      address1: '123 Main St',
    }

    const result = createHouseholdSchema.safeParse(validInput)
    // Empty array should fail - need at least one guest with primary contact
    expect(result.success).toBe(false)
  })

  it('should allow optional address fields', () => {
    const validInput = {
      guestParty: [
        {
          firstName: 'John',
          lastName: 'Doe',
          isPrimaryContact: true,
          invites: { 'event-123': 'Invited' },
        },
      ],
    }

    const result = createHouseholdSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('should validate email format when provided', () => {
    const invalidInput = {
      guestParty: [
        {
          firstName: 'John',
          lastName: 'Doe',
          isPrimaryContact: true,
          invites: {},
        },
      ],
      email: 'not-an-email',
    }

    const result = createHouseholdSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })

  it('should allow null for optional fields', () => {
    const validInput = {
      guestParty: [
        {
          firstName: 'John',
          lastName: 'Doe',
          isPrimaryContact: true,
          invites: {},
        },
      ],
      address1: null,
      address2: null,
      city: null,
    }

    const result = createHouseholdSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('maps an invitedCount of 0 to null — a household is never known to have 0 people', () => {
    const input = {
      guestParty: [
        {
          firstName: 'John',
          lastName: 'Doe',
          isPrimaryContact: true,
          invites: {},
        },
      ],
      invitedCount: 0,
    }

    const result = createHouseholdSchema.safeParse(input)
    expect(result.success).toBe(true)
    expect(result.success && result.data.invitedCount).toBeNull()
  })

  it('preserves a positive invitedCount', () => {
    const input = {
      guestParty: [
        {
          firstName: 'John',
          lastName: 'Doe',
          isPrimaryContact: true,
          invites: {},
        },
      ],
      invitedCount: 6,
    }

    const result = createHouseholdSchema.safeParse(input)
    expect(result.success).toBe(true)
    expect(result.success && result.data.invitedCount).toBe(6)
  })

  it('still accepts a missing invitedCount — CSV import rows routinely omit it', () => {
    const input = {
      guestParty: [
        { firstName: 'John', lastName: 'Doe', isPrimaryContact: true, invites: {} },
      ],
    }

    const result = createHouseholdSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('keeps an attendingCount of 0 as 0 — unlike invitedCount, 0 is a real, confirmed answer', () => {
    const input = {
      guestParty: [
        { firstName: 'John', lastName: 'Doe', isPrimaryContact: true, invites: {} },
      ],
      attendingCount: 0,
    }

    const result = createHouseholdSchema.safeParse(input)
    expect(result.success).toBe(true)
    expect(result.success && result.data.attendingCount).toBe(0)
  })

  it('accepts a missing attendingCount as undefined — "no number known yet"', () => {
    const input = {
      guestParty: [
        { firstName: 'John', lastName: 'Doe', isPrimaryContact: true, invites: {} },
      ],
    }

    const result = createHouseholdSchema.safeParse(input)
    expect(result.success).toBe(true)
    expect(result.success && result.data.attendingCount).toBeUndefined()
  })

  it('accepts an explicit null attendingCount, distinct from 0 or missing', () => {
    const input = {
      guestParty: [
        { firstName: 'John', lastName: 'Doe', isPrimaryContact: true, invites: {} },
      ],
      attendingCount: null,
    }

    const result = createHouseholdSchema.safeParse(input)
    expect(result.success).toBe(true)
    expect(result.success && result.data.attendingCount).toBeNull()
  })

  it('rejects an attendingCount outside the 0 to 50 range', () => {
    const input = {
      guestParty: [
        { firstName: 'John', lastName: 'Doe', isPrimaryContact: true, invites: {} },
      ],
      attendingCount: 51,
    }

    const result = createHouseholdSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})

describe('createHouseholdManualSchema — the guest-list "add household" form', () => {
  const validGuestParty = [
    { firstName: 'John', lastName: 'Doe', isPrimaryContact: true, invites: {} },
  ]

  it('rejects a missing invitedCount with the Hebrew mandatory-count message', () => {
    const result = createHouseholdManualSchema.safeParse({ guestParty: validGuestParty })

    expect(result.success).toBe(false)
    expect(result.success || result.error.issues[0]?.message).toBe(
      'יש להזין מספר מוזמנים בין 1 ל-30'
    )
  })

  it('rejects an invitedCount of 0 — it never means "unknown" here, unlike the lenient schema', () => {
    const result = createHouseholdManualSchema.safeParse({
      guestParty: validGuestParty,
      invitedCount: 0,
    })

    expect(result.success).toBe(false)
  })

  it('rejects an invitedCount above 30', () => {
    const result = createHouseholdManualSchema.safeParse({
      guestParty: validGuestParty,
      invitedCount: 31,
    })

    expect(result.success).toBe(false)
  })

  it('accepts an invitedCount within 1 to 30', () => {
    const result = createHouseholdManualSchema.safeParse({
      guestParty: validGuestParty,
      invitedCount: 30,
    })

    expect(result.success).toBe(true)
    expect(result.success && result.data.invitedCount).toBe(30)
  })

  it('still enforces exactly one primary contact', () => {
    const result = createHouseholdManualSchema.safeParse({
      guestParty: [{ firstName: 'John', lastName: 'Doe', isPrimaryContact: false, invites: {} }],
      invitedCount: 3,
    })

    expect(result.success).toBe(false)
  })
})

describe('updateHouseholdSchema', () => {
  it('should validate a valid household update input', () => {
    const validInput = {
      householdId: 'household-123',
      guestParty: [
        {
          guestId: 1,
          firstName: 'John',
          lastName: 'Doe',
          isPrimaryContact: true,
          invites: { 'event-123': 'Attending' },
        },
      ],
      address1: '456 New St',
      gifts: [
        {
          eventId: 'event-123',
          thankyou: true,
          description: 'Beautiful vase',
        },
      ],
    }

    const result = updateHouseholdSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('should require householdId', () => {
    const invalidInput = {
      guestParty: [
        {
          firstName: 'John',
          lastName: 'Doe',
          isPrimaryContact: true,
          invites: {},
        },
      ],
      gifts: [],
    }

    const result = updateHouseholdSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })

  it('should require gifts array', () => {
    const invalidInput = {
      householdId: 'household-123',
      guestParty: [
        {
          firstName: 'John',
          lastName: 'Doe',
          isPrimaryContact: true,
          invites: {},
        },
      ],
    }

    const result = updateHouseholdSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })

  it('should allow deletedGuests array', () => {
    const validInput = {
      householdId: 'household-123',
      guestParty: [
        {
          firstName: 'John',
          lastName: 'Doe',
          isPrimaryContact: true,
          invites: {},
        },
      ],
      deletedGuests: [1, 2, 3],
      gifts: [],
    }

    const result = updateHouseholdSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })
})

describe('deleteHouseholdSchema', () => {
  it('should validate valid householdId', () => {
    const result = deleteHouseholdSchema.safeParse({ householdId: 'household-123' })
    expect(result.success).toBe(true)
  })

  it('should require non-empty householdId', () => {
    const result = deleteHouseholdSchema.safeParse({ householdId: '' })
    expect(result.success).toBe(false)
  })
})

describe('searchHouseholdSchema', () => {
  it('should validate valid search text', () => {
    const result = searchHouseholdSchema.safeParse({ searchText: 'John' })
    expect(result.success).toBe(true)
  })

  it('should require minimum 2 characters', () => {
    const result = searchHouseholdSchema.safeParse({ searchText: 'J' })
    expect(result.success).toBe(false)
  })
})

describe('householdIdSchema', () => {
  it('should validate valid householdId', () => {
    const result = householdIdSchema.safeParse({ householdId: 'household-123' })
    expect(result.success).toBe(true)
  })

  it('should require non-empty householdId', () => {
    const result = householdIdSchema.safeParse({ householdId: '' })
    expect(result.success).toBe(false)
  })
})

describe('phone validation in household schemas', () => {
  const baseGuestParty = [
    {
      firstName: 'John',
      lastName: 'Doe',
      isPrimaryContact: true,
      invites: {},
    },
  ]

  it('accepts valid E.164 phone numbers', () => {
    expect(
      createHouseholdSchema.safeParse({
        guestParty: baseGuestParty,
        phone: '+12025550123',
      }).success
    ).toBe(true)

    expect(
      updateHouseholdSchema.safeParse({
        householdId: 'household-123',
        guestParty: baseGuestParty,
        gifts: [],
        phone: '+447911123456',
      }).success
    ).toBe(true)
  })

  it('rejects invalid phone numbers with a clear message', () => {
    const result = createHouseholdSchema.safeParse({
      guestParty: baseGuestParty,
      phone: '2025550123',
    })
    expect(result.success).toBe(false)
    expect(
      result.error?.issues.some((issue) => issue.message === 'הזינו מספר טלפון תקין')
    ).toBe(true)
  })

  it('accepts undefined and null', () => {
    expect(
      createHouseholdSchema.safeParse({
        guestParty: baseGuestParty,
        phone: undefined,
      }).success
    ).toBe(true)

    expect(
      updateHouseholdSchema.safeParse({
        householdId: 'household-123',
        guestParty: baseGuestParty,
        gifts: [],
        phone: null,
      }).success
    ).toBe(true)
  })

  it('transforms empty string to null', () => {
    const result = createHouseholdSchema.safeParse({
      guestParty: baseGuestParty,
      phone: '',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.phone).toBeNull()
    }
  })
})

describe('side and groupName in baseHouseholdFields', () => {
  const baseGuestParty = [
    { firstName: 'John', lastName: 'Doe', isPrimaryContact: true, invites: {} },
  ]

  it('trims surrounding whitespace', () => {
    const result = updateHouseholdSchema.safeParse({
      householdId: 'household-123',
      guestParty: baseGuestParty,
      gifts: [],
      side: '  כלה  ',
      groupName: '  משפחה מירב  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.side).toBe('כלה')
      expect(result.data.groupName).toBe('משפחה מירב')
    }
  })

  it('folds an empty or whitespace-only value to null instead of writing blank text', () => {
    const result = updateHouseholdSchema.safeParse({
      householdId: 'household-123',
      guestParty: baseGuestParty,
      gifts: [],
      side: '',
      groupName: '   ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.side).toBeNull()
      expect(result.data.groupName).toBeNull()
    }
  })

  it('passes an explicit null straight through', () => {
    const result = updateHouseholdSchema.safeParse({
      householdId: 'household-123',
      guestParty: baseGuestParty,
      gifts: [],
      side: null,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.side).toBeNull()
    }
  })

  it('leaves an omitted field undefined', () => {
    const result = updateHouseholdSchema.safeParse({
      householdId: 'household-123',
      guestParty: baseGuestParty,
      gifts: [],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.side).toBeUndefined()
    }
  })
})

describe('createHouseholdManualSchema — write-time text normalization', () => {
  it('stores trimmed, single-spaced name/group/city and a lowercased, trimmed email', () => {
    const result = createHouseholdManualSchema.safeParse({
      invitedCount: 2,
      city: '  Tel   Aviv  ',
      groupName: '  משפחה   מירב  ',
      email: '  John.Doe@Example.com  ',
      guestParty: [
        {
          firstName: 'אבירן ',
          lastName: '  צומו ',
          isPrimaryContact: true,
          invites: { 'event-123': 'Invited' },
        },
      ],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.city).toBe('Tel Aviv')
    expect(result.data.groupName).toBe('משפחה מירב')
    expect(result.data.email).toBe('john.doe@example.com')
    expect(result.data.guestParty[0]?.firstName).toBe('אבירן')
    expect(result.data.guestParty[0]?.lastName).toBe('צומו')
  })
})
