/**
 * WhatsApp Domain - Barrel Export
 */

import { WhatsAppRepository } from '~/server/domains/whatsapp/whatsapp.repository'
import { WhatsAppService } from '~/server/domains/whatsapp/whatsapp.service'
import { db } from '~/server/infrastructure/database'

const whatsAppRepository = new WhatsAppRepository(db)
export const whatsAppService = new WhatsAppService(whatsAppRepository)

export { WhatsAppRepository } from '~/server/domains/whatsapp/whatsapp.repository'
export { WhatsAppService } from '~/server/domains/whatsapp/whatsapp.service'
export type {
  WhatsAppAccount,
  WhatsAppAccountView,
  WhatsAppTestConnectionResult,
} from '~/server/domains/whatsapp/whatsapp.types'
export {
  type SaveAccountInput,
  saveAccountSchema,
} from '~/server/domains/whatsapp/whatsapp.validator'
