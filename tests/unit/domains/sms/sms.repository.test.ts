import { SmsRepository } from '~/server/domains/sms/sms.repository'

describe('SmsRepository', () => {
  it('upserts re-sends as REMINDER rows', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'reminder-1' })
    const repository = new SmsRepository({ smsOutbound: { upsert } } as never)

    await repository.queueReminder({
      weddingId: 'wedding-1',
      householdId: 'household-1',
      guestId: 7,
      toPhone: '+972541234567',
      body: 'הודעה',
    })

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          weddingId_householdId_kind: {
            weddingId: 'wedding-1',
            householdId: 'household-1',
            kind: 'REMINDER',
          },
        },
        create: expect.objectContaining({ kind: 'REMINDER' }),
      })
    )
  })
})
