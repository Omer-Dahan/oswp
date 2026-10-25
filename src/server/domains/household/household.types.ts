/**
 * Household Domain - Types
 *
 * Type definitions for the Household domain entity.
 * Households represent guest groups/families sharing an address.
 *
 * Note: Input types are derived from Zod schemas (single source of truth).
 * Only entity types representing database models are manually defined.
 */

import type { Gift } from '~/server/domains/gift/gift.types'
import type { GuestWithInvitations } from '~/server/domains/guest/guest.types'
import type {
  CreateHouseholdSchemaInput,
  DeleteHouseholdSchemaInput,
  GiftInputSchemaInput,
  GuestPartyInputSchemaInput,
  SearchHouseholdSchemaInput,
  UpdateHouseholdSchemaInput,
} from '~/server/domains/household/household.validator'

/**
 * Core Household entity type
 */
export type Household = {
  id: string
  weddingId: string
  createdAt: Date
  updatedAt: Date
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  country: string | null
  likelihoodOfAttending: number | null
  notes: string | null
  invitedCount: number | null
  side: string | null
  groupName: string | null
  attendingCount: number | null
  childrenCount: number | null
  dietaryNotes: string | null
}

/**
 * Household with guests included
 */
export type HouseholdWithGuests = Household & {
  guests: GuestWithInvitations[]
}

/**
 * Household with guests and gifts included
 * Gifts include the event name
 */
export type HouseholdWithGuestsAndGifts = Household & {
  guests: GuestWithInvitations[]
  gifts: Array<Gift & { event: { name: string } }>
}

/**
 * Input types derived from Zod schemas (single source of truth)
 * These re-exports provide cleaner names and centralize type definitions
 */
export type GuestPartyInput = GuestPartyInputSchemaInput
export type GiftInput = GiftInputSchemaInput
export type CreateHouseholdInput = CreateHouseholdSchemaInput
export type UpdateHouseholdInput = UpdateHouseholdSchemaInput
export type DeleteHouseholdInput = DeleteHouseholdSchemaInput
export type SearchHouseholdInput = SearchHouseholdSchemaInput

/**
 * Search result type
 */
export type HouseholdSearchResult = {
  id: string
  guests: GuestWithInvitations[]
}

/**
 * Guest shape exposed to unauthenticated, guest-facing RSVP flows (public name
 * search and invite-code recognition). Deliberately excludes contact fields
 * (email, phone) and invitations the household wasn't actually sent, since
 * these endpoints are reachable by anyone who can guess a guest's name.
 */
export type PublicRsvpGuest = {
  id: number
  firstName: string
  lastName: string
  isPrimaryContact: boolean
  isTagAlong: boolean
  ageGroup: 'INFANT' | 'CHILD' | 'TEEN' | 'ADULT' | null
  invitations: Array<{ id: string; eventId: string; rsvp: string }>
}

/**
 * Household search result shape for the public RSVP flow (see PublicRsvpGuest).
 */
export type PublicHouseholdSearchResult = {
  id: string
  invitedCount: number | null
  attendingCount: number | null
  childrenCount: number | null
  dietaryNotes: string | null
  guests: PublicRsvpGuest[]
}
