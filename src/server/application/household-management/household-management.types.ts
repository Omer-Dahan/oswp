/**
 * Household Management Application Service - Types
 *
 * Types for complex household management operations that span multiple domains.
 */

import type { Gift } from '~/server/domains/gift'
import type { GuestWithInvitations } from '~/server/domains/guest'
import type {
  GuestPartyInput as DomainGuestPartyInput,
  GuestPartyUpdateInput as DomainGuestPartyUpdateInput,
} from '~/server/domains/household'
import type { Invitation } from '~/server/domains/invitation'

/**
 * Guest party input with optional fields for creation
 * Based on domain GuestPartyInput but with optional isPrimaryContact for flexibility
 */
export type GuestPartyInput = Omit<
  DomainGuestPartyInput,
  'isPrimaryContact' | 'ageGroup' | 'tagIds'
> & {
  isPrimaryContact?: boolean
  ageGroup?: 'INFANT' | 'CHILD' | 'TEEN' | 'ADULT'
  isTagAlong?: boolean
  tagIds?: string[]
}

/**
 * Guest party input for updating a household. Every field but `invites` is
 * optional and carries no default - a save from a panel that doesn't own a
 * given field must send it as `undefined` so the service and repository
 * leave the existing value untouched instead of blanking it.
 */
export type GuestPartyUpdateInput = DomainGuestPartyUpdateInput

/**
 * Input for creating a household with guests
 */
export type CreateHouseholdWithGuestsInput = {
  address1?: string | null
  address2?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  zipCode?: string | null
  likelihoodOfAttending?: number | null
  notes?: string | null
  invitedCount?: number | null
  side?: string | null
  groupName?: string | null
  phoneAlt?: string | null
  expectedCheck?: number | null
  guestParty: GuestPartyInput[]
}

/**
 * Input for updating a household with guests
 */
export type UpdateHouseholdWithGuestsInput = {
  householdId: string
  address1?: string | null
  address2?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  zipCode?: string | null
  likelihoodOfAttending?: number | null
  notes?: string | null
  // The guest-list drawer sends these on every edit, but they were missing from
  // this input type, so a household's side/group/party size could be set at
  // creation time and never changed afterwards - the UI showed a success
  // message and the database kept the old value (owner report, 2026-11-03).
  invitedCount?: number | null
  side?: string | null
  groupName?: string | null
  phoneAlt?: string | null
  expectedCheck?: number | null
  guestParty: GuestPartyUpdateInput[]
  deletedGuests?: number[]
  gifts: Array<{
    eventId: string
    description?: string | null
    thankyou?: boolean
  }>
}

/**
 * Result of creating a household with guests
 */
export type CreateHouseholdResult = {
  household: {
    id: string
    address1: string | null
    address2: string | null
    city: string | null
    state: string | null
    country: string | null
    zipCode: string | null
    likelihoodOfAttending: number | null
    notes: string | null
    gifts: Gift[]
  }
  guests: GuestWithInvitations[]
}

/**
 * Result of updating a household with guests
 */
export type UpdateHouseholdResult = {
  household: {
    id: string
    address1: string | null
    address2: string | null
    city: string | null
    state: string | null
    country: string | null
    zipCode: string | null
    likelihoodOfAttending: number | null
    notes: string | null
  }
  guests: Array<{
    id: number
    firstName: string
    lastName: string
    isPrimaryContact: boolean
    householdId: string
    weddingId: string
    invitations: Invitation[]
  }>
  gifts: Gift[]
}
