import type { SmsOutbound } from '@prisma/client'

import { SmsRepository } from '~/server/domains/sms/sms.repository'

describe('SmsRepository status transitions', () => {
  const queuedAt = new Date('2026-11-11T09:00:00.000Z')
  const originalSentAt = new Date('2026-11-11T09:01:00.000Z')
  const updateMany = jest.fn()
  const findUniqueOrThrow = jest.fn()
  let row: SmsOutbound
  let repository: SmsRepository

  beforeEach(() => {
    jest.resetAllMocks()
    row = {
      id: 'sms-1',
      weddingId: 'wedding-1',
      householdId: 'household-1',
      guestId: 7,
      eventId: null,
      kind: 'REMINDER',
      toPhone: '+972541234567',
      body: 'Reminder',
      status: 'QUEUED',
      providerMessageId: null,
      error: null,
      reminderCount: 0,
      queuedAt,
      sentAt: null,
    }

    updateMany.mockImplementation(async ({ where, data }) => {
      if (row.id !== where.id || row.status !== where.status) return { count: 0 }

      row = {
        ...row,
        ...data,
        reminderCount:
          typeof data.reminderCount === 'object'
            ? row.reminderCount + data.reminderCount.increment
            : (data.reminderCount ?? row.reminderCount),
      }
      return { count: 1 }
    })
    findUniqueOrThrow.mockImplementation(async () => row)
    repository = new SmsRepository({
      smsOutbound: { updateMany, findUniqueOrThrow },
    } as never)
  })

  it('applies a QUEUED to SENT transition', async () => {
    const result = await repository.markReminderSent('sms-1', 'provider-1')

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'sms-1', status: 'QUEUED' },
      data: {
        status: 'SENT',
        providerMessageId: 'provider-1',
        error: null,
        reminderCount: { increment: 1 },
        sentAt: expect.any(Date),
      },
    })
    expect(result).toEqual(row)
    expect(result).toMatchObject({
      status: 'SENT',
      providerMessageId: 'provider-1',
      error: null,
      reminderCount: 1,
    })
  })

  it('leaves a SENT row unchanged after a second SENT write', async () => {
    row = {
      ...row,
      status: 'SENT',
      providerMessageId: 'provider-original',
      reminderCount: 1,
      sentAt: originalSentAt,
    }
    const original = row

    const result = await repository.markReminderSent('sms-1', 'provider-late')

    expect(result).toEqual(original)
    expect(row).toEqual(original)
  })

  it('refuses a FAILED to SENT transition', async () => {
    row = { ...row, status: 'FAILED', error: 'Original failure' }
    const original = row

    const result = await repository.markSent('sms-1', 'provider-late')

    expect(result).toEqual(original)
    expect(row).toEqual(original)
  })

  it('refuses a SENT to FAILED transition', async () => {
    row = {
      ...row,
      status: 'SENT',
      providerMessageId: 'provider-original',
      reminderCount: 1,
      sentAt: originalSentAt,
    }
    const original = row

    const result = await repository.markReminderFailed('sms-1', 'Late failure')

    expect(result).toEqual(original)
    expect(row).toEqual(original)
  })
})
