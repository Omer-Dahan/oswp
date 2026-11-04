/**
 * Guest Self-Add Application Service - Barrel Export
 */

import { householdInviteService } from '~/server/application/household-invite'
import { GuestSelfAddService } from '~/server/application/guest-self-add/guest-self-add.service'
import { db } from '~/server/infrastructure/database'

export const guestSelfAddService = new GuestSelfAddService(db, householdInviteService)

export { GuestSelfAddService } from '~/server/application/guest-self-add/guest-self-add.service'
export type { GuestSelfAddResult } from '~/server/application/guest-self-add/guest-self-add.service'
export {
  type GuestSelfAddSchemaInput,
  guestSelfAddSchema,
} from '~/server/application/guest-self-add/guest-self-add.validator'
