/**
 * Self-Fill Registration Application Service - Barrel Export
 *
 * Orchestrates cross-domain guest self-registration.
 * Token management lives in ~/server/domains/self-fill.
 */

import { SelfFillRegistrationService } from '~/server/application/self-fill-registration/self-fill-registration.service'
import { SelfFillRepository } from '~/server/domains/self-fill/self-fill.repository'
import { db } from '~/server/infrastructure/database'

// Create repository instances
const selfFillRepo = new SelfFillRepository(db)

export const selfFillRegistrationService = new SelfFillRegistrationService(db, selfFillRepo)

export { SelfFillRegistrationService } from '~/server/application/self-fill-registration/self-fill-registration.service'
