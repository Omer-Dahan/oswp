import type { SmsOutboundStatus } from '@prisma/client'

export type SmsRecipient = {
  householdId: string
  householdName: string
  primaryContact: string
  phone: string | null
  inviteCode: string | null
  status: SmsOutboundStatus | null
  error: string | null
  sendable: boolean
  preview: string | null
}

export type SmsSendOutcome = {
  householdId: string
  status: 'SENT' | 'FAILED'
  error?: string
}
