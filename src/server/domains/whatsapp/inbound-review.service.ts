/**
 * WhatsApp Domain - Inbound Review
 *
 * Human review for inbound replies the webhook couldn't auto-apply (low
 * confidence, unknown intent, unmatched phone, headcount-only). Applying a
 * decision here reuses WhatsAppRepository.applyHouseholdRsvp - the same
 * path the webhook uses for confident replies - so there is exactly one
 * place that flips Invitation status from an inbound WhatsApp reply.
 */

import { TRPCError } from '@trpc/server'
import type { Prisma } from '@prisma/client'

import type { AuthzContext } from '~/server/authz/authorization.types'
import { requirePermission } from '~/server/authz/permission-checker'
import type { WhatsAppRepository } from '~/server/domains/whatsapp/whatsapp.repository'
import type { PendingInboundView } from '~/server/domains/whatsapp/whatsapp.types'
import type { ResolveInboundInput } from '~/server/domains/whatsapp/whatsapp.validator'

function guestFullName(guest: { firstName: string; lastName: string } | null): string | null {
  return guest ? `${guest.firstName} ${guest.lastName}`.trim() : null
}

function householdLabel(
  household: { guests: Array<{ firstName: string; lastName: string; isPrimaryContact: boolean }> } | null
): string | null {
  if (!household || household.guests.length === 0) return null
  const primary = household.guests.find((g) => g.isPrimaryContact) ?? household.guests[0]
  if (!primary) return null
  const others = household.guests.length - 1
  const name = `${primary.firstName} ${primary.lastName}`.trim()
  return others > 0 ? `${name} +${others}` : name
}

export class InboundReviewService {
  constructor(private repo: WhatsAppRepository) {}

  async listPendingInbound(
    ctx: AuthzContext,
    weddingId: string,
    limit?: number
  ): Promise<PendingInboundView[]> {
    requirePermission(ctx, { wedding: ['read'] })

    const rows = await this.repo.findPendingInbound(weddingId, limit)
    return rows.map((row) => ({
      id: row.id,
      receivedAt: row.receivedAt,
      fromPhone: row.fromPhone,
      text: row.text,
      parsed: row.parsed as PendingInboundView['parsed'],
      guestName: guestFullName(row.guest) ?? row.profileName,
      householdLabel: householdLabel(row.household),
      householdUnmatched: row.householdId === null,
    }))
  }

  async resolveInbound(
    ctx: AuthzContext,
    weddingId: string,
    input: ResolveInboundInput
  ): Promise<{ ok: true }> {
    requirePermission(ctx, { wedding: ['update'] })

    if (input.decision === 'dismissed') {
      await this.repo.markInboundHandled(weddingId, input.inboundId)
      return { ok: true }
    }

    const row = await this.repo.findInboundById(weddingId, input.inboundId)
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Inbound message not found' })
    }
    if (!row.guestId || !row.householdId) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'אי אפשר לעדכן הזמנה - הטלפון הזה לא משויך למשק בית',
      })
    }

    await this.repo.applyHouseholdRsvp(input.inboundId, {
      guestId: row.guestId,
      householdId: row.householdId,
      rsvp: input.decision === 'attending' ? 'Attending' : 'Declined',
      parsed: (row.parsed ?? {}) as Prisma.InputJsonValue,
    })

    return { ok: true }
  }
}
