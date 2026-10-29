import type { SmsOutboundStatus } from '@prisma/client'

export type SmsRecipient = {
  householdId: string
  householdName: string
  primaryContact: string
  groupName: string | null
  phone: string | null
  inviteCode: string | null
  inviteLink: string | null
  status: SmsOutboundStatus | null
  error: string | null
  sentAt: Date | null
  sendable: boolean
  preview: string | null
}

export type SmsSendOutcome = {
  householdId: string
  status: 'SENT' | 'FAILED'
  error?: string
}
