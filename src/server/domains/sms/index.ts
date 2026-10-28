import { SmsRepository } from '~/server/domains/sms/sms.repository'
import { SmsService } from '~/server/domains/sms/sms.service'
import { db } from '~/server/infrastructure/database'
import { HttpSmsGateway } from '~/server/infrastructure/sms/sms-gateway'

const smsRepository = new SmsRepository(db)
export const smsService = new SmsService(smsRepository, new HttpSmsGateway())

export { SmsRepository } from '~/server/domains/sms/sms.repository'
export { SmsService } from '~/server/domains/sms/sms.service'
export type { SmsRecipient, SmsSendOutcome } from '~/server/domains/sms/sms.types'
