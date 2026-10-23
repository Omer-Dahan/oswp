/**
 * Tests for WhatsApp Domain Rules
 */

import {
  DAILY_RECIPIENT_CAP,
  allocateWithinDailyCap,
  dailyCapErrorMessage,
  decideLinkPhoneToGuest,
  partitionAlreadyMessaged,
} from '~/server/domains/whatsapp/whatsapp.rules'

describe('allocateWithinDailyCap', () => {
  it('refuses candidates beyond the daily unique-recipient cap', () => {
    const candidates = Array.from({ length: 5 }, (_, i) => ({ phone: `+97250000000${i}` }))

    const { toQueue, overCap } = allocateWithinDailyCap(candidates, new Set(), 3)

    expect(toQueue).toHaveLength(3)
    expect(overCap).toHaveLength(2)
    expect(dailyCapErrorMessage(DAILY_RECIPIENT_CAP)).toContain(String(DAILY_RECIPIENT_CAP))
  })

  it('does not consume extra cap headroom for a phone already counted in the window', () => {
    const candidates = [{ phone: '+972500000001' }, { phone: '+972500000002' }]
    const alreadyCounted = new Set(['+972500000001'])

    const { toQueue, overCap } = allocateWithinDailyCap(candidates, alreadyCounted, 1)

    expect(toQueue.map((c) => c.phone)).toEqual(['+972500000001'])
    expect(overCap.map((c) => c.phone)).toEqual(['+972500000002'])
  })
})

describe('partitionAlreadyMessaged', () => {
  it('skips households already messaged with the same kind+template', () => {
    const candidates = [
      { householdId: 'h1' },
      { householdId: 'h2' },
      { householdId: 'h3' },
    ]
    const alreadyMessaged = new Set(['h1', 'h3'])

    const { toSend, skipped } = partitionAlreadyMessaged(candidates, alreadyMessaged, false)

    expect(toSend.map((c) => c.householdId)).toEqual(['h2'])
    expect(skipped.map((c) => c.householdId)).toEqual(['h1', 'h3'])
  })

  it('sends to everyone, including already-messaged households, when resend is true', () => {
    const candidates = [{ householdId: 'h1' }, { householdId: 'h2' }]
    const alreadyMessaged = new Set(['h1'])

    const { toSend, skipped } = partitionAlreadyMessaged(candidates, alreadyMessaged, true)

    expect(toSend).toHaveLength(2)
    expect(skipped).toHaveLength(0)
  })
})

describe('decideLinkPhoneToGuest', () => {
  it('allows linking when the guest has no phone', () => {
    expect(decideLinkPhoneToGuest(null, '+972501234567', false)).toEqual({ status: 'allowed' })
  })

  it('allows linking when the guest phone matches, normalised', () => {
    const decision = decideLinkPhoneToGuest('050-123-4567', '+972501234567', false)
    expect(decision).toEqual({ status: 'allowed' })
  })

  it('requires confirmation when the guest has a different phone and replacePhone is not set', () => {
    const decision = decideLinkPhoneToGuest('+972509999999', '+972501234567', false)
    expect(decision).toEqual({ status: 'requiresReplaceConfirmation', existingPhone: '+972509999999' })
  })

  it('allows overwriting a different phone when replacePhone is true', () => {
    const decision = decideLinkPhoneToGuest('+972509999999', '+972501234567', true)
    expect(decision).toEqual({ status: 'allowed' })
  })
})
