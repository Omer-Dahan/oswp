jest.mock('~/lib/auth-permissions', () => require('~/lib/__mocks__/auth-permissions'))

import type { SmsHouseholdRow } from '~/server/domains/sms/sms.repository'
import { SmsService } from '~/server/domains/sms/sms.service'
import { encryptSecret } from '~/server/infrastructure/crypto/secrets'

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
    listHouseholds: jest.fn(),
    findHousehold: jest.fn(),
    listSenders: jest.fn().mockResolvedValue([]),
    findSender: jest.fn(),
    findActiveSenderForSide: jest.fn().mockResolvedValue(null),
    findDefaultSender: jest.fn().mockResolvedValue(null),
    createSender: jest.fn(),
    updateSender: jest.fn(),
    setDefaultSender: jest.fn(),
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
  const configuredGateway = { send: jest.fn() }
  const gatewayFactory = jest.fn().mockReturnValue(configuredGateway)
  return {
    service: new SmsService(repo as never, gateway, gatewayFactory),
    repo,
    gateway,
    configuredGateway,
    gatewayFactory,
  }
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
    expect(repo.findHousehold).not.toHaveBeenCalled()
  })

  it('returns groom-side and bride-side households but not unassigned households', async () => {
    const { service, repo } = setup()
    repo.listHouseholds.mockResolvedValue([
      household(),
      household({ id: 'bride', side: 'כלה' }),
      household({ id: 'unassigned', side: null }),
    ])

    const result = await service.listRecipients(authz, 'wedding-1')

    expect(result.map((recipient) => recipient.householdId)).toEqual(['household-1', 'bride'])
  })

  it('rejects a crafted bride-side household request', async () => {
    const { service, repo, gateway } = setup()
    repo.findHousehold.mockResolvedValue(household({ side: 'כלה' }))
    repo.queueInvite.mockResolvedValue({ id: 'sms-1' })
    gateway.send.mockResolvedValue({ ok: true })

    await expect(service.sendInvite(authz, 'wedding-1', 'household-1')).resolves.toMatchObject({
      status: 'SENT',
    })
  })

  it('refuses a duplicate send after SENT', async () => {
    const { service, repo, gateway } = setup()
    repo.findHousehold.mockResolvedValue(
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
    repo.findHousehold.mockResolvedValue(
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

  it('allows a bride-side re-send', async () => {
    const { service, repo, gateway } = setup()
    repo.findHousehold.mockResolvedValue(
      household({
        side: 'כלה',
        smsOutbound: [
          { kind: 'INVITE', status: 'SENT', error: null, sentAt: new Date(), reminderCount: 0 },
        ],
      })
    )
    repo.queueReminder.mockResolvedValue({ id: 'reminder-1' })
    repo.markReminderSent.mockResolvedValue({ sentAt: new Date() })
    gateway.send.mockResolvedValue({ ok: true })

    await expect(service.sendAgain(authz, 'wedding-1', 'household-1')).resolves.toMatchObject({
      status: 'SENT',
    })
  })

  it('writes FAILED with the gateway error', async () => {
    const { service, repo, gateway } = setup()
    repo.findHousehold.mockResolvedValue(household())
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
    repo.findHousehold.mockResolvedValue(household())
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
    repo.findHousehold.mockResolvedValue(household())
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

  it('resolves an explicit sender before the matching-side and default senders', async () => {
    const { service, repo, configuredGateway, gatewayFactory, gateway } = setup()
    const explicit = {
      id: 'sender-explicit',
      weddingId: 'wedding-1',
      label: 'חתן ראשי',
      side: 'חתן',
      gatewayUrl: 'https://api.sms-gate.app',
      username: 'explicit-user',
      passwordEnc: encryptSecret('explicit-password'),
      deviceId: null,
      phoneMasked: null,
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    repo.findHousehold.mockResolvedValue(household())
    repo.findSender.mockResolvedValue(explicit)
    repo.queueInvite.mockResolvedValue({ id: 'sms-1' })
    configuredGateway.send.mockResolvedValue({ ok: true })

    await service.sendInvite(authz, 'wedding-1', {
      householdId: 'household-1',
      senderId: explicit.id,
    })

    expect(gatewayFactory).toHaveBeenCalledWith({
      url: explicit.gatewayUrl,
      username: explicit.username,
      password: 'explicit-password',
    })
    expect(repo.findActiveSenderForSide).not.toHaveBeenCalled()
    expect(gateway.send).not.toHaveBeenCalled()
  })

  it('uses a matching active sender before the default sender', async () => {
    const { service, repo, configuredGateway, gatewayFactory } = setup()
    const sideSender = {
      id: 'sender-side',
      weddingId: 'wedding-1',
      label: 'צד חתן',
      side: 'חתן',
      gatewayUrl: 'https://side.example.com',
      username: 'side-user',
      passwordEnc: encryptSecret('side-password'),
      deviceId: null,
      phoneMasked: null,
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    repo.findHousehold.mockResolvedValue(household())
    repo.findActiveSenderForSide.mockResolvedValue(sideSender)
    repo.queueInvite.mockResolvedValue({ id: 'sms-1' })
    configuredGateway.send.mockResolvedValue({ ok: true })

    await service.sendInvite(authz, 'wedding-1', 'household-1')

    expect(gatewayFactory).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'side-user', password: 'side-password' })
    )
    expect(repo.findDefaultSender).not.toHaveBeenCalled()
  })

  it('uses the default sender when no active sender matches the household side', async () => {
    const { service, repo, configuredGateway, gatewayFactory } = setup()
    const defaultSender = {
      id: 'sender-default',
      weddingId: 'wedding-1',
      label: 'ברירת מחדל',
      side: 'כלה',
      gatewayUrl: 'https://default.example.com',
      username: 'default-user',
      passwordEnc: encryptSecret('default-password'),
      deviceId: null,
      phoneMasked: null,
      isDefault: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    repo.findHousehold.mockResolvedValue(household({ side: 'כלה' }))
    repo.findDefaultSender.mockResolvedValue(defaultSender)
    repo.queueInvite.mockResolvedValue({ id: 'sms-1' })
    configuredGateway.send.mockResolvedValue({ ok: true })

    await service.sendInvite(authz, 'wedding-1', 'household-1')

    expect(gatewayFactory).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'default-user', password: 'default-password' })
    )
  })

  it('uses the environment gateway when no sender rows resolve', async () => {
    const { service, repo, gateway, gatewayFactory } = setup()
    repo.findHousehold.mockResolvedValue(household())
    repo.queueInvite.mockResolvedValue({ id: 'sms-1' })
    gateway.send.mockResolvedValue({ ok: true })

    await service.sendInvite(authz, 'wedding-1', 'household-1')

    expect(gateway.send).toHaveBeenCalled()
    expect(gatewayFactory).not.toHaveBeenCalled()
  })

  it('guards a cross-side sender and proceeds only after confirmation', async () => {
    const { service, repo, configuredGateway } = setup()
    const brideSender = {
      id: 'sender-bride',
      weddingId: 'wedding-1',
      label: 'צד כלה',
      side: 'כלה',
      gatewayUrl: 'https://api.sms-gate.app',
      username: 'bride-user',
      passwordEnc: encryptSecret('bride-password'),
      deviceId: null,
      phoneMasked: null,
      isDefault: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    repo.findHousehold.mockResolvedValue(household({ side: 'חתן' }))
    repo.findSender.mockResolvedValue(brideSender)
    repo.queueInvite.mockResolvedValue({ id: 'sms-1' })
    configuredGateway.send.mockResolvedValue({ ok: true })

    await expect(
      service.sendInvite(authz, 'wedding-1', {
        householdId: 'household-1',
        senderId: brideSender.id,
      })
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'שים לב: ההודעה מיועדת לצד חתן אך נשלחת ממספר של צד כלה.',
    })
    expect(repo.queueInvite).not.toHaveBeenCalled()

    await expect(
      service.sendInvite(authz, 'wedding-1', {
        householdId: 'household-1',
        senderId: brideSender.id,
        confirmCrossSide: true,
      })
    ).resolves.toMatchObject({ status: 'SENT' })
  })

  it('never returns plaintext or encrypted passwords in sender list payloads', async () => {
    const { service, repo } = setup()
    const passwordEnc = encryptSecret('top-secret-password')
    repo.listSenders.mockResolvedValue([
      {
        id: 'sender-1',
        weddingId: 'wedding-1',
        label: 'צד חתן',
        side: 'חתן',
        gatewayUrl: 'https://api.sms-gate.app',
        username: 'gateway-user',
        passwordEnc,
        deviceId: null,
        phoneMasked: null,
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])

    const result = await service.listSenders(authz, 'wedding-1')
    const serialized = JSON.stringify(result)

    expect(result[0]).toMatchObject({
      usernameMasked: '••••user',
      passwordMasked: '••••word',
    })
    expect(serialized).not.toContain('top-secret-password')
    expect(serialized).not.toContain(passwordEnc)
    expect(serialized).not.toContain('gateway-user')
  })
})
