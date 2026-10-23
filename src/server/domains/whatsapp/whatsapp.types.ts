/**
 * WhatsApp Domain - Types
 */

import type { WhatsAppAccount as PrismaWhatsAppAccount } from '@prisma/client'

export type WhatsAppAccount = PrismaWhatsAppAccount

export type WhatsAppAccountView = {
  configured: boolean
  phoneNumberId: string | null
  wabaId: string | null
  accessTokenMasked: string | null
  appSecretMasked: string | null
  displayPhoneNumber: string | null
  verifiedName: string | null
  status: PrismaWhatsAppAccount['status']
  lastCheckedAt: Date | null
  lastError: string | null
}

export type WhatsAppTestConnectionResult = {
  status: PrismaWhatsAppAccount['status']
  displayPhoneNumber: string | null
  verifiedName: string | null
  error: string | null
}

export type PendingInboundParsed = {
  intent?: 'attending' | 'declined' | 'unknown'
  headcount?: number | null
  confidence?: 'high' | 'low'
  reason?: string
}

export type PendingInboundView = {
  id: string
  receivedAt: Date
  fromPhone: string
  text: string | null
  parsed: PendingInboundParsed | null
  guestName: string | null
  householdLabel: string | null
  householdUnmatched: boolean
}
