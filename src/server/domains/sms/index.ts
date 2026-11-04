import { householdInviteService } from '~/server/application/household-invite'
import { SmsRepository } from '~/server/domains/sms/sms.repository'
import { SmsService } from '~/server/domains/sms/sms.service'
import { db } from '~/server/infrastructure/database'
import { createSmsGateway, HttpSmsGateway } from '~/server/infrastructure/sms/sms-gateway'

const smsRepository = new SmsRepository(db)
export const smsService = new SmsService(smsRepository, new HttpSmsGateway(), createSmsGateway, {
  db,
  householdInviteService,
})

export { SmsRepository } from '~/server/domains/sms/sms.repository'
export { SmsService } from '~/server/domains/sms/sms.service'
export type { SmsRecipient, SmsSendOutcome } from '~/server/domains/sms/sms.types'
