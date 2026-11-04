import type { ViewMode } from '~/components/guest-list/v2/list/list-toolbar'

export type SortDirection = 'none' | 'ascending' | 'descending'

export type GuestListFilters = {
  search: string
  rsvp: { eventId: string; rsvpValue: string } | null
  tagId: string | null
  country: string | null
  side: string | null
  group: string | null
}

export type GuestListViewState = {
  viewMode: ViewMode
  nameSort: SortDirection
  partySort: SortDirection
  filters: GuestListFilters
}

export const DEFAULT_GUEST_LIST_VIEW_STATE: GuestListViewState = {
  viewMode: 'cards',
  nameSort: 'none',
  partySort: 'none',
  filters: {
    search: '',
    rsvp: null,
    tagId: null,
    country: null,
    side: null,
    group: null,
  },
}

export const guestListViewStateKey = (weddingId: string) => `oswp:guest-list-view:${weddingId}:v1`

const isSortDirection = (value: unknown): value is SortDirection =>
  value === 'none' || value === 'ascending' || value === 'descending'

export function readGuestListViewState(weddingId: string | null): GuestListViewState {
  if (!weddingId || typeof window === 'undefined') return DEFAULT_GUEST_LIST_VIEW_STATE

  try {
    const stored = JSON.parse(
      localStorage.getItem(guestListViewStateKey(weddingId)) ?? 'null'
    ) as Partial<GuestListViewState> | null
    if (!stored) return DEFAULT_GUEST_LIST_VIEW_STATE

    const filters: Partial<GuestListFilters> = stored.filters ?? {}
    return {
      viewMode: stored.viewMode === 'table' ? 'table' : 'cards',
      nameSort: isSortDirection(stored.nameSort) ? stored.nameSort : 'none',
      partySort: isSortDirection(stored.partySort) ? stored.partySort : 'none',
      filters: {
        search: typeof filters.search === 'string' ? filters.search : '',
        rsvp:
          filters.rsvp &&
          typeof filters.rsvp.eventId === 'string' &&
          typeof filters.rsvp.rsvpValue === 'string'
            ? filters.rsvp
            : null,
        tagId: typeof filters.tagId === 'string' ? filters.tagId : null,
        country: typeof filters.country === 'string' ? filters.country : null,
        side: typeof filters.side === 'string' ? filters.side : null,
        group: typeof filters.group === 'string' ? filters.group : null,
      },
    }
  } catch {
    return DEFAULT_GUEST_LIST_VIEW_STATE
  }
}

export function writeGuestListViewState(weddingId: string | null, state: GuestListViewState) {
  if (!weddingId || typeof window === 'undefined') return
  localStorage.setItem(guestListViewStateKey(weddingId), JSON.stringify(state))
}

export function clearGuestListViewState(weddingId: string | null) {
  if (!weddingId || typeof window === 'undefined') return
  localStorage.removeItem(guestListViewStateKey(weddingId))
}
