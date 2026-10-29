jest.mock('~/lib/auth-permissions', () => require('~/lib/__mocks__/auth-permissions'))

import type { SmsHouseholdRow } from '~/server/domains/sms/sms.repository'
import { SmsService } from '~/server/domains/sms/sms.service'

const authz = {
  userId: 'user-1',
  activeOrganization: { organizationId: 'org-1', role: 'owner' },
}

function household(overrides: Partial<SmsHouseholdRow> = {}): SmsHouseholdRow {
  return {
    id: 'household-1',
    weddingId: 'wedding-1',
    side: 'חתן',
    groupName: 'משפחת כהן',
    inviteCode: 'ab-123',
    guests: [
      {
        id: 7,
        firstName: 'דוד יעקב',
        lastName: 'כהן',
        phone: '054-123-4567',
        isPrimaryContact: true,
      },
    ],
    smsOutbound: [],
    ...overrides,
  }
}

function setup() {
  const repo = {
    listGroomHouseholds: jest.fn(),
    findGroomHousehold: jest.fn(),
    queueInvite: jest.fn(),
    queueReminder: jest.fn(),
    markSent: jest.fn(),
    markReminderSent: jest.fn(),
    markFailed: jest.fn(),
    markReminderFailed: jest.fn(),
    getInviteTemplate: jest.fn().mockResolvedValue(null),
    setInviteTemplate: jest.fn(),
  }
  const gateway = { send: jest.fn() }
  return { service: new SmsService(repo as never, gateway), repo, gateway }
}

describe('SmsService', () => {
  it('rejects sending without the send permission', async () => {
    const { service, repo } = setup()
    const viewerAuthz = {
      ...authz,
      activeOrganization: { organizationId: 'org-1', role: 'viewer' },
    }

    await expect(service.sendInvite(viewerAuthz, 'wedding-1', 'household-1')).rejects.toMatchObject(
      {
        code: 'FORBIDDEN',
      }
    )
    expect(repo.findGroomHousehold).not.toHaveBeenCalled()
  })

  it('never returns bride-side or unassigned households', async () => {
    const { service, repo } = setup()
    repo.listGroomHouseholds.mockResolvedValue([
      household(),
      household({ id: 'bride', side: 'כלה' }),
      household({ id: 'unassigned', side: null }),
    ])

    const result = await service.listRecipients(authz, 'wedding-1')

    expect(result.map((recipient) => recipient.householdId)).toEqual(['household-1'])
  })

  it('rejects a crafted bride-side household request', async () => {
    const { service, repo, gateway } = setup()
    repo.findGroomHousehold.mockResolvedValue(household({ side: 'כלה' }))

    await expect(service.sendInvite(authz, 'wedding-1', 'household-1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect(gateway.send).not.toHaveBeenCalled()
  })

  it('refuses a duplicate send after SENT', async () => {
    const { service, repo, gateway } = setup()
    repo.findGroomHousehold.mockResolvedValue(
      household({
        smsOutbound: [
          { kind: 'INVITE', status: 'SENT', error: null, sentAt: new Date(), reminderCount: 0 },
        ],
      })
    )

    await expect(service.sendInvite(authz, 'wedding-1', 'household-1')).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    expect(gateway.send).not.toHaveBeenCalled()
  })

  it('sends a REMINDER after the original invite was sent', async () => {
    const { service, repo, gateway } = setup()
    repo.findGroomHousehold.mockResolvedValue(
      household({
        smsOutbound: [
          { kind: 'INVITE', status: 'SENT', error: null, sentAt: new Date(), reminderCount: 0 },
        ],
      })
    )
    repo.queueReminder.mockResolvedValue({ id: 'reminder-1' })
    repo.markReminderSent.mockResolvedValue({ sentAt: new Date('2026-10-29T14:39:00Z') })
    gateway.send.mockResolvedValue({ ok: true, providerMessageId: 'provider-2' })

    await expect(service.sendAgain(authz, 'wedding-1', 'household-1')).resolves.toMatchObject({
      householdId: 'household-1',
      status: 'SENT',
    })
    expect(repo.queueReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        weddingId: 'wedding-1',
        householdId: 'household-1',
      })
    )
  })

  it('rejects a bride-side re-send', async () => {
    const { service, repo, gateway } = setup()
    repo.findGroomHousehold.mockResolvedValue(household({ side: 'כלה' }))

    await expect(service.sendAgain(authz, 'wedding-1', 'household-1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect(gateway.send).not.toHaveBeenCalled()
  })

  it('writes FAILED with the gateway error', async () => {
    const { service, repo, gateway } = setup()
    repo.findGroomHousehold.mockResolvedValue(household())
    repo.queueInvite.mockResolvedValue({ id: 'sms-1' })
    gateway.send.mockResolvedValue({ ok: false, error: 'Cloudflare 1010' })

    await expect(service.sendInvite(authz, 'wedding-1', 'household-1')).resolves.toEqual({
      householdId: 'household-1',
      status: 'FAILED',
      error: 'Cloudflare 1010',
    })
    expect(repo.markFailed).toHaveBeenCalledWith('sms-1', 'Cloudflare 1010')
  })

  it('marks an accepted message SENT with the provider id', async () => {
    const { service, repo, gateway } = setup()
    repo.findGroomHousehold.mockResolvedValue(household())
    repo.queueInvite.mockResolvedValue({ id: 'sms-1' })
    gateway.send.mockResolvedValue({ ok: true, providerMessageId: 'provider-1' })

    await expect(service.sendInvite(authz, 'wedding-1', 'household-1')).resolves.toEqual({
      householdId: 'household-1',
      status: 'SENT',
    })
    expect(repo.markSent).toHaveBeenCalledWith('sms-1', 'provider-1')
  })

  it('renders the stored wedding template before sending', async () => {
    const { service, repo, gateway } = setup()
    repo.findGroomHousehold.mockResolvedValue(household())
    repo.getInviteTemplate.mockResolvedValue('שלום {שם}: {קישור}')
    repo.queueInvite.mockResolvedValue({ id: 'sms-1' })
    gateway.send.mockResolvedValue({ ok: true })

    await service.sendInvite(authz, 'wedding-1', 'household-1')

    expect(gateway.send).toHaveBeenCalledWith(
      '+972541234567',
      'שלום יעקב כהן: https://david-and-morasha.duckdns.org/w/guests/save-the-date/ab-123'
    )
    expect(repo.queueInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'שלום יעקב כהן: https://david-and-morasha.duckdns.org/w/guests/save-the-date/ab-123',
      })
    )
  })
})
