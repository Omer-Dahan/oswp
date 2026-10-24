/**
 * Website Domain - Barrel Export
 *
 * Exports all website domain components for use throughout the application.
 */

import { WebsiteRepository } from '~/server/domains/website/website.repository'
import { WebsiteService } from '~/server/domains/website/website.service'
import { WebsitePasswordService } from '~/server/domains/website/website-password.service'
import { db } from '~/server/infrastructure/database'
import { PrismaRateLimiter } from '~/server/infrastructure/rate-limit'

// Create singleton instances
const websiteRepository = new WebsiteRepository(db)
const websitePasswordService = new WebsitePasswordService()
const websitePasswordRateLimiter = new PrismaRateLimiter(db, { limit: 10, windowMs: 15 * 60_000 })
export const websiteService = new WebsiteService(
  websiteRepository,
  websitePasswordRateLimiter,
  websitePasswordService
)

// Export classes for testing/DI
export { WebsiteRepository } from '~/server/domains/website/website.repository'
// Export router
export { websiteRouter } from '~/server/domains/website/website.router'
export { WebsiteService } from '~/server/domains/website/website.service'
// Export types
export type {
  CreateWebsiteInput,
  PublicWebsite,
  UpdateCoverPhotoInput,
  UpdateRsvpEnabledInput,
  UpdateWebsiteInput,
  Website,
  WebsiteWithComputedUrl,
  WebsiteWithQuestions,
  WeddingDate,
  WeddingPageData,
} from '~/server/domains/website/website.types'
export { computeWebsiteUrl } from '~/server/domains/website/website.utils'
// Export validators
export {
  type AnswerToQuestion,
  type CreateWebsiteSchemaInput,
  createWebsiteSchema,
  fetchWeddingDataSchema,
  getBySubUrlSchema,
  type HasPasswordAccessSchemaInput,
  hasPasswordAccessSchema,
  type RsvpResponse,
  type SubmitRsvpSchemaInput,
  submitRsvpSchema,
  type UpdateCoverPhotoSchemaInput,
  type UpdateRsvpEnabledSchemaInput,
  type UpdateWebsiteSchemaInput,
  updateCoverPhotoSchema,
  updateRsvpEnabledSchema,
  updateWebsiteSchema,
  type VerifyWebsitePasswordSchemaInput,
  verifyWebsitePasswordSchema,
} from '~/server/domains/website/website.validator'
export { WebsitePasswordService } from '~/server/domains/website/website-password.service'
