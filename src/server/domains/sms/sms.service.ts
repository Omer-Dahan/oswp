import { TRPCError } from '@trpc/server'
import {
  buildWeddingInviteLink,
  buildWeddingInviteSmsFromTemplate,
  DEFAULT_SMS_INVITE_TEMPLATE,
  formatSmsRecipientName,
} from '~/lib/sms/invite-message'
import type { AuthzContext } from '~/server/authz/authorization.types'
import { requirePermission } from '~/server/authz/permission-checker'
import type {
  SmsHouseholdRow,
  SmsRepository,
  SmsSenderRow,
} from '~/server/domains/sms/sms.repository'
import type { SmsRecipient, SmsSenderView, SmsSendOutcome } from '~/server/domains/sms/sms.types'
import type { CreateSmsSenderInput, UpdateSmsSenderInput } from '~/server/domains/sms/sms.validator'
import { decryptSecret, encryptSecret, maskSecret } from '~/server/infrastructure/crypto/secrets'
import {
  createSmsGateway,
  type SmsGateway,
  type SmsGatewayCredentials,
} from '~/server/infrastructure/sms/sms-gateway'

type SendSmsInput = {
  householdId: string
  senderId?: string
  confirmCrossSide?: boolean
}

function toIsraeliE164(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  const local = digits.length >= 9 ? digits.slice(-9) : ''
  return local.length === 9 ? `+972${local}` : null
}

function toRecipient(household: SmsHouseholdRow, template: string | null): SmsRecipient {
  const contact = household.guests[0]
  const primaryContact = contact
    ? formatSmsRecipientName(contact.firstName, contact.lastName)
    : 'לא הוגדר איש קשר'
  const phone = toIsraeliE164(contact?.phone ?? null)
  const outbound = household.smsOutbound.find((message) => message.kind === 'INVITE')
  const reminder = household.smsOutbound.find((message) => message.kind === 'REMINDER')
  const preview = contact
    ? buildWeddingInviteSmsFromTemplate({
        firstName: contact.firstName,
        lastName: contact.lastName,
        inviteCode: household.inviteCode,
        template,
      })
    : null

  return {
    householdId: household.id,
    householdName: household.groupName?.trim() || primaryContact,
    primaryContact,
    side: household.side ?? '',
    groupName: household.groupName,
    phone,
    inviteCode: household.inviteCode,
    inviteLink: household.inviteCode ? buildWeddingInviteLink(household.inviteCode) : null,
    status: outbound?.status ?? null,
    error: outbound?.error ?? null,
    lastSentAt: outbound?.sentAt ?? null,
    reminderCount: reminder?.reminderCount ?? 0,
    lastReminderAt: reminder?.sentAt ?? null,
    sendable: Boolean(phone && preview && outbound?.status !== 'SENT'),
    preview,
  }
}

function toSenderView(sender: SmsSenderRow): SmsSenderView {
  return {
    id: sender.id,
    label: sender.label,
    side: sender.side,
    gatewayUrl: sender.gatewayUrl,
    usernameMasked: maskSecret(sender.username),
    passwordMasked: maskSecret(decryptSecret(sender.passwordEnc)),
    deviceId: sender.deviceId,
    phoneMasked: sender.phoneMasked,
    isDefault: sender.isDefault,
    isActive: sender.isActive,
  }
}

export class SmsService {
  constructor(
    private repo: SmsRepository,
    private fallbackGateway: SmsGateway,
    private gatewayFactory: (credentials: SmsGatewayCredentials) => SmsGateway = createSmsGateway
  ) {}

  async listRecipients(ctx: AuthzContext, weddingId: string): Promise<SmsRecipient[]> {
    requirePermission(ctx, { guest: ['read'] })
    const [households, template] = await Promise.all([
      this.repo.listHouseholds(weddingId),
      this.repo.getInviteTemplate(weddingId),
    ])
    return households
      .filter((household) => household.side === 'חתן' || household.side === 'כלה')
      .map((household) => toRecipient(household, template))
  }

  async listSenders(ctx: AuthzContext, weddingId: string): Promise<SmsSenderView[]> {
    requirePermission(ctx, { guest: ['read'] })
    return (await this.repo.listSenders(weddingId)).map(toSenderView)
  }

  async createSender(
    ctx: AuthzContext,
    weddingId: string,
    input: CreateSmsSenderInput
  ): Promise<SmsSenderView> {
    requirePermission(ctx, { guest_invitation: ['send'] })
    const sender = await this.repo.createSender({
      weddingId,
      label: input.label,
      side: input.side,
      gatewayUrl: input.gatewayUrl,
      username: input.username,
      passwordEnc: encryptSecret(input.password),
      deviceId: input.deviceId || null,
    })
    return toSenderView(sender)
  }

  async updateSender(
    ctx: AuthzContext,
    weddingId: string,
    input: UpdateSmsSenderInput
  ): Promise<SmsSenderView> {
    requirePermission(ctx, { guest_invitation: ['send'] })
    const existing = await this.requireSender(weddingId, input.id)
    const sender = await this.repo.updateSender(weddingId, input.id, {
      label: input.label,
      side: input.side,
      gatewayUrl: input.gatewayUrl,
      username: input.username ?? existing.username,
      deviceId: input.deviceId || null,
      passwordEnc: input.password ? encryptSecret(input.password) : existing.passwordEnc,
    })
    return toSenderView(sender)
  }

  async setDefaultSender(
    ctx: AuthzContext,
    weddingId: string,
    senderId: string
  ): Promise<SmsSenderView> {
    requirePermission(ctx, { guest_invitation: ['send'] })
    await this.requireSender(weddingId, senderId)
    return toSenderView(await this.repo.setDefaultSender(weddingId, senderId))
  }

  async setSenderActive(
    ctx: AuthzContext,
    weddingId: string,
    senderId: string,
    isActive: boolean
  ): Promise<SmsSenderView> {
    requirePermission(ctx, { guest_invitation: ['send'] })
    await this.requireSender(weddingId, senderId)
    return toSenderView(
      await this.repo.updateSender(weddingId, senderId, {
        isActive,
        ...(isActive ? {} : { isDefault: false }),
      })
    )
  }

  async getTemplate(ctx: AuthzContext, weddingId: string): Promise<string> {
    requirePermission(ctx, { guest: ['read'] })
    return (await this.repo.getInviteTemplate(weddingId)) ?? DEFAULT_SMS_INVITE_TEMPLATE
  }

  async setTemplate(
    ctx: AuthzContext,
    weddingId: string,
    template: string | null
  ): Promise<string> {
    requirePermission(ctx, { guest_invitation: ['send'] })
    const normalized = template?.trim() ? template : null
    return (await this.repo.setInviteTemplate(weddingId, normalized)) ?? DEFAULT_SMS_INVITE_TEMPLATE
  }

  async sendInvite(
    ctx: AuthzContext,
    weddingId: string,
    input: SendSmsInput | string
  ): Promise<SmsSendOutcome> {
    requirePermission(ctx, { guest_invitation: ['send'] })
    const request = typeof input === 'string' ? { householdId: input } : input
    const household = await this.requireHousehold(weddingId, request.householdId)
    const existing = household.smsOutbound.find((message) => message.kind === 'INVITE')
    if (existing?.status === 'SENT') {
      throw new TRPCError({ code: 'CONFLICT', message: 'הודעת ההזמנה כבר נשלחה למשק בית זה.' })
    }

    const message = await this.buildMessage(weddingId, household)
    const gateway = await this.resolveGateway(weddingId, household.side ?? '', request)
    const outbound = await this.repo.queueInvite({
      weddingId,
      householdId: household.id,
      guestId: message.contactId,
      toPhone: message.phone,
      body: message.body,
    })
    const result = await gateway.send(message.phone, message.body)
    if (!result.ok) {
      const error = result.error ?? 'שליחת ה-SMS נכשלה'
      await this.repo.markFailed(outbound.id, error)
      return { householdId: household.id, status: 'FAILED', error }
    }

    await this.repo.markSent(outbound.id, result.providerMessageId)
    return { householdId: household.id, status: 'SENT' }
  }

  async sendAgain(
    ctx: AuthzContext,
    weddingId: string,
    input: SendSmsInput | string
  ): Promise<SmsSendOutcome> {
    requirePermission(ctx, { guest_invitation: ['send'] })
    const request = typeof input === 'string' ? { householdId: input } : input
    const household = await this.requireHousehold(weddingId, request.householdId)
    const invite = household.smsOutbound.find((message) => message.kind === 'INVITE')
    if (invite?.status !== 'SENT') {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'ניתן לשלוח שוב רק לאחר שההזמנה המקורית נשלחה.',
      })
    }

    const message = await this.buildMessage(weddingId, household)
    const gateway = await this.resolveGateway(weddingId, household.side ?? '', request)
    const outbound = await this.repo.queueReminder({
      weddingId,
      householdId: household.id,
      guestId: message.contactId,
      toPhone: message.phone,
      body: message.body,
    })
    const result = await gateway.send(message.phone, message.body)
    if (!result.ok) {
      const error = result.error ?? 'שליחת ה-SMS נכשלה'
      await this.repo.markReminderFailed(outbound.id, error)
      return { householdId: household.id, status: 'FAILED', error, sentAt: null }
    }

    const sent = await this.repo.markReminderSent(outbound.id, result.providerMessageId)
    return { householdId: household.id, status: 'SENT', sentAt: sent.sentAt }
  }

  private async requireHousehold(weddingId: string, householdId: string) {
    const household = await this.repo.findHousehold(weddingId, householdId)
    if (!household) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'משק הבית לא נמצא.' })
    }
    return household
  }

  private async requireSender(weddingId: string, senderId: string) {
    const sender = await this.repo.findSender(weddingId, senderId)
    if (!sender) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'המספר השולח לא נמצא.' })
    }
    return sender
  }

  private async buildMessage(weddingId: string, household: SmsHouseholdRow) {
    const contact = household.guests[0]
    const phone = toIsraeliE164(contact?.phone ?? null)
    const template = await this.repo.getInviteTemplate(weddingId)
    const body = contact
      ? buildWeddingInviteSmsFromTemplate({
          firstName: contact.firstName,
          lastName: contact.lastName,
          inviteCode: household.inviteCode,
          template,
        })
      : null
    if (!contact || !phone || !body) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'למשק הבית חסרים איש קשר ראשי, מספר טלפון תקין או קוד הזמנה.',
      })
    }
    return { contactId: contact.id, phone, body }
  }

  private async resolveGateway(
    weddingId: string,
    householdSide: string,
    input: Pick<SendSmsInput, 'senderId' | 'confirmCrossSide'>
  ): Promise<SmsGateway> {
    const sender = input.senderId
      ? await this.requireSender(weddingId, input.senderId)
      : ((await this.repo.findActiveSenderForSide(weddingId, householdSide)) ??
        (await this.repo.findDefaultSender(weddingId)))

    if (!sender) return this.fallbackGateway
    if (!sender.isActive) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'המספר השולח אינו פעיל.' })
    }
    if (sender.side !== householdSide && !input.confirmCrossSide) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `שים לב: ההודעה מיועדת לצד ${householdSide} אך נשלחת ממספר של צד ${sender.side}.`,
      })
    }
    return this.gatewayFactory({
      url: sender.gatewayUrl,
      username: sender.username,
      password: decryptSecret(sender.passwordEnc),
    })
  }
}
