/**
 * WhatsApp Domain - Barrel Export
 */

import { InboundReviewService } from '~/server/domains/whatsapp/inbound-review.service'
import { MessagingSender } from '~/server/domains/whatsapp/messaging-sender'
import { WebhookService } from '~/server/domains/whatsapp/webhook.service'
import { WhatsAppRepository } from '~/server/domains/whatsapp/whatsapp.repository'
import { WhatsAppService } from '~/server/domains/whatsapp/whatsapp.service'
import { db } from '~/server/infrastructure/database'

const whatsAppRepository = new WhatsAppRepository(db)
const messagingSender = new MessagingSender(whatsAppRepository)
export const whatsAppService = new WhatsAppService(whatsAppRepository, messagingSender)
export const webhookService = new WebhookService(whatsAppRepository)
export const inboundReviewService = new InboundReviewService(whatsAppRepository)
export { whatsAppRepository }

export { InboundReviewService } from '~/server/domains/whatsapp/inbound-review.service'
export { MessagingSender } from '~/server/domains/whatsapp/messaging-sender'
export {
  extractPhoneNumberId,
  parseWebhookPayload,
  verifyWebhookSignature,
  WebhookService,
} from '~/server/domains/whatsapp/webhook.service'
export { WhatsAppRepository } from '~/server/domains/whatsapp/whatsapp.repository'
export { WhatsAppService } from '~/server/domains/whatsapp/whatsapp.service'
export type {
  PendingInboundParsed,
  PendingInboundView,
  WhatsAppAccount,
  WhatsAppAccountView,
  WhatsAppTestConnectionResult,
} from '~/server/domains/whatsapp/whatsapp.types'
export {
  type LinkInboundInput,
  linkInboundSchema,
  type ListPendingInboundInput,
  listPendingInboundSchema,
  type ProcessQueueInput,
  processQueueSchema,
  type QueueBatchInput,
  queueBatchSchema,
  listRecentOutboundSchema,
  type ResolveInboundInput,
  resolveInboundSchema,
  type SaveAccountInput,
  saveAccountSchema,
} from '~/server/domains/whatsapp/whatsapp.validator'
