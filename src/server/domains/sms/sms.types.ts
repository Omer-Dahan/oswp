import type { SmsOutboundStatus } from '@prisma/client'

export type SmsRecipient = {
  householdId: string
  householdName: string
  primaryContact: string
  side: string
  groupName: string | null
  phone: string | null
  inviteCode: string | null
  inviteLink: string | null
  status: SmsOutboundStatus | null
  error: string | null
  lastSentAt: Date | null
  reminderCount: number
  lastReminderAt: Date | null
  sendable: boolean
  preview: string | null
}

export type SmsSenderView = {
  id: string
  label: string
  side: string
  gatewayUrl: string
  usernameMasked: string
  passwordMasked: string
  deviceId: string | null
  phoneMasked: string | null
  isDefault: boolean
  isActive: boolean
}

export type SmsSendOutcome = {
  householdId: string
  status: 'SENT' | 'FAILED'
  error?: string
  sentAt?: Date | null
}
