import { TRPCError } from '@trpc/server'
import {
  buildWeddingInviteLink,
  buildWeddingInviteSmsFromTemplate,
  DEFAULT_SMS_INVITE_TEMPLATE,
  formatSmsRecipientName,
} from '~/lib/sms/invite-message'
import type { AuthzContext } from '~/server/authz/authorization.types'
import { requirePermission } from '~/server/authz/permission-checker'
import type { SmsHouseholdRow, SmsRepository } from '~/server/domains/sms/sms.repository'
import type { SmsRecipient, SmsSendOutcome } from '~/server/domains/sms/sms.types'
import type { SmsGateway } from '~/server/infrastructure/sms/sms-gateway'

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

export class SmsService {
  constructor(
    private repo: SmsRepository,
    private gateway: SmsGateway
  ) {}

  async listRecipients(ctx: AuthzContext, weddingId: string): Promise<SmsRecipient[]> {
    requirePermission(ctx, { guest: ['read'] })
    const [households, template] = await Promise.all([
      this.repo.listGroomHouseholds(weddingId),
      this.repo.getInviteTemplate(weddingId),
    ])
    return households
      .filter((household) => household.side === 'חתן')
      .map((household) => toRecipient(household, template))
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
    householdId: string
  ): Promise<SmsSendOutcome> {
    requirePermission(ctx, { guest_invitation: ['send'] })
    const household = await this.repo.findGroomHousehold(weddingId, householdId)
    if (household?.side !== 'חתן') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'ניתן לשלוח SMS רק למשקי בית מצד החתן.',
      })
    }

    const existing = household.smsOutbound[0]
    if (existing?.status === 'SENT') {
      throw new TRPCError({ code: 'CONFLICT', message: 'הודעת ההזמנה כבר נשלחה למשק בית זה.' })
    }

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

    const outbound = await this.repo.queueInvite({
      weddingId,
      householdId,
      guestId: contact.id,
      toPhone: phone,
      body,
    })
    const result = await this.gateway.send(phone, body)
    if (!result.ok) {
      const error = result.error ?? 'שליחת ה-SMS נכשלה'
      await this.repo.markFailed(outbound.id, error)
      return { householdId, status: 'FAILED', error }
    }

    await this.repo.markSent(outbound.id, result.providerMessageId)
    return { householdId, status: 'SENT' }
  }

  async sendAgain(
    ctx: AuthzContext,
    weddingId: string,
    householdId: string
  ): Promise<SmsSendOutcome> {
    requirePermission(ctx, { guest_invitation: ['send'] })
    const household = await this.repo.findGroomHousehold(weddingId, householdId)
    if (household?.side !== 'חתן') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'ניתן לשלוח SMS רק למשקי בית מצד החתן.',
      })
    }

    const invite = household.smsOutbound.find((message) => message.kind === 'INVITE')
    if (invite?.status !== 'SENT') {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'ניתן לשלוח שוב רק לאחר שההזמנה המקורית נשלחה.',
      })
    }

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

    const outbound = await this.repo.queueReminder({
      weddingId,
      householdId,
      guestId: contact.id,
      toPhone: phone,
      body,
    })
    const result = await this.gateway.send(phone, body)
    if (!result.ok) {
      const error = result.error ?? 'שליחת ה-SMS נכשלה'
      await this.repo.markReminderFailed(outbound.id, error)
      return { householdId, status: 'FAILED', error, sentAt: null }
    }

    const sent = await this.repo.markReminderSent(outbound.id, result.providerMessageId)
    return { householdId, status: 'SENT', sentAt: sent.sentAt }
  }
}
