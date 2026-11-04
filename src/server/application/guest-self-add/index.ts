/**
 * Guest Self-Add Application Service - Barrel Export
 */

import { GuestSelfAddService } from '~/server/application/guest-self-add/guest-self-add.service'
import { db } from '~/server/infrastructure/database'

export const guestSelfAddService = new GuestSelfAddService(db)

export type { GuestSelfAddResult } from '~/server/application/guest-self-add/guest-self-add.service'
export { GuestSelfAddService } from '~/server/application/guest-self-add/guest-self-add.service'
export {
  type GuestSelfAddSchemaInput,
  guestSelfAddSchema,
} from '~/server/application/guest-self-add/guest-self-add.validator'
