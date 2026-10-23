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
