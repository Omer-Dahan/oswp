import type { PrismaClient } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import {
  buildWeddingInviteLink,
  formatSmsRecipientName,
  renderWeddingInviteSmsTemplate,
} from '~/lib/sms/invite-message'
import type { HouseholdInviteService } from '~/server/application/household-invite/household-invite.service'

export type InviteMessageSource = 'side' | 'default' | 'wedding-template' | 'built-in-default'

export type ResolvedInviteMessage = {
  message: string
  body: string
  signature: string | null
  side: string | null
  source: InviteMessageSource
}

/**
 * Resolution order: a template row for the household's own side, then the
 * wedding's default row (side = null), then the legacy Wedding.smsInviteTemplate,
 * then the code-level default. A household with no (or an unrecognized) side
 * only ever reaches the default row/template — it must never inherit another
 * side's signature.
 */
export async function resolveInviteMessage(
  db: PrismaClient,
  householdInviteService: HouseholdInviteService,
  weddingId: string,
  householdId: string
): Promise<ResolvedInviteMessage> {
  const household = await db.household.findFirst({
    where: { id: householdId, weddingId },
    select: {
      id: true,
      side: true,
      guests: {
        where: { isPrimaryContact: true },
        take: 1,
        orderBy: { id: 'asc' },
        select: { firstName: true, lastName: true },
      },
    },
  })
  if (!household) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'משק הבית לא נמצא.' })
  }

  const contact = household.guests[0]
  const recipientName = contact ? formatSmsRecipientName(contact.firstName, contact.lastName) : ''
  const side = household.side?.trim() || null

  const inviteCode = await householdInviteService.ensureInviteCode(householdId)
  const inviteLink = inviteCode ? buildWeddingInviteLink(inviteCode) : ''

  const [sideTemplate, defaultTemplate] = await Promise.all([
    side ? db.inviteMessageTemplate.findFirst({ where: { weddingId, side } }) : null,
    db.inviteMessageTemplate.findFirst({ where: { weddingId, side: null } }),
  ])

  const templateRow = sideTemplate ?? defaultTemplate
  if (templateRow) {
    const body = renderWeddingInviteSmsTemplate({
      template: templateRow.body,
      recipientName,
      inviteLink,
    })
    const signature = templateRow.signature?.trim() || null
    const message = signature ? `${body}\n\nבברכה - ${signature}` : body
    return {
      message,
      body,
      signature,
      side,
      source: sideTemplate ? 'side' : 'default',
    }
  }

  const wedding = await db.wedding.findUniqueOrThrow({
    where: { id: weddingId },
    select: { smsInviteTemplate: true },
  })
  const message = renderWeddingInviteSmsTemplate({
    template: wedding.smsInviteTemplate,
    recipientName,
    inviteLink,
  })
  return {
    message,
    body: message,
    signature: null,
    side,
    source: wedding.smsInviteTemplate ? 'wedding-template' : 'built-in-default',
  }
}
