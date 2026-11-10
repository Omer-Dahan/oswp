/**
 * Shared, side-effect-free household filter predicate for the admin guest
 * list. Both `GuestSearchFilter` (interactive filtering UI) and `GuestsView`
 * (the list that must not flicker to the unfiltered set on every refetch)
 * apply the exact same logic from here, so there is one definition of "what
 * a filter combination matches" instead of two that can drift apart.
 */
import type { GuestListFilters } from '~/components/guest-list/guest-list-view-state'
import { forSearch, matchesSearchTerms } from '~/lib/text/normalize'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'

export const NO_SIDE_FILTER_KEY = '__no_side__'
export const NO_GROUP_FILTER_TOKEN = '__no_group__'
export const GROUP_SIDE_ORDER = ['חתן', 'כלה', 'ללא צד'] as const

/** A household's side bucket for the group dropdown's per-side sections. */
export const affiliationSide = (
  side: string | null | undefined
): (typeof GROUP_SIDE_ORDER)[number] => {
  const normalizedSide = side?.trim()
  return normalizedSide === 'חתן' || normalizedSide === 'כלה' ? normalizedSide : 'ללא צד'
}

/** The side filter's option key for a household's raw side value. */
export const sideKeyFor = (side: string | null | undefined) =>
  side?.trim().toLowerCase() || NO_SIDE_FILTER_KEY

/**
 * The group filter's option key: side-scoped (two sides can both have a
 * "חברים" group without colliding, finding #5) and tolerant-normalized
 * (so a name with a stray double space matches its one real group, #11).
 */
export const groupKeyFor = (side: string, groupName: string | null | undefined) => {
  const trimmed = groupName?.trim()
  return `${side}|${trimmed ? forSearch(trimmed) : NO_GROUP_FILTER_TOKEN}`
}

export function applyGuestListFilters(
  households: HouseholdWithGuests[],
  filters: GuestListFilters
): HouseholdWithGuests[] {
  return households.filter((household) => {
    if (filters.country.length > 0 && !filters.country.includes(household.country ?? ''))
      return false

    if (filters.side.length > 0 && !filters.side.includes(sideKeyFor(household.side))) return false

    if (filters.group.length > 0) {
      const key = groupKeyFor(affiliationSide(household.side), household.groupName)
      if (!filters.group.includes(key)) return false
    }

    if (
      filters.tagId.length > 0 &&
      !household.guests.some((guest) =>
        guest.guestTags?.some((tag) => filters.tagId.includes(tag.tagId))
      )
    ) {
      return false
    }

    const householdSearchHaystack = [
      ...household.guests.flatMap((guest) => [guest.firstName, guest.lastName]),
      household.groupName,
    ]
      .filter(Boolean)
      .join(' ')
    const matchesName = matchesSearchTerms(householdSearchHaystack, filters.search)

    return household.guests.some((guest) => {
      return filters.rsvp.length > 0
        ? matchesName &&
            guest.invitations?.some((invitation) =>
              filters.rsvp.some(
                (filter) =>
                  invitation.eventId === filter.eventId && invitation.rsvp === filter.rsvpValue
              )
            )
        : matchesName
    })
  })
}
