import type { ViewMode } from '~/components/guest-list/v2/list/list-toolbar'

export type SortDirection = 'none' | 'ascending' | 'descending'

export type GuestListFilters = {
  search: string
  rsvp: Array<{ eventId: string; rsvpValue: string }>
  tagId: string[]
  country: string[]
  side: string[]
  group: string[]
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
    rsvp: [],
    tagId: [],
    country: [],
    side: [],
    group: [],
  },
}

export const guestListViewStateKey = (weddingId: string) => `oswp:guest-list-view:${weddingId}:v1`

const isSortDirection = (value: unknown): value is SortDirection =>
  value === 'none' || value === 'ascending' || value === 'descending'

const storedStrings = (value: unknown) => {
  if (Array.isArray(value))
    return value.filter((entry): entry is string => typeof entry === 'string')
  return typeof value === 'string' ? [value] : []
}

const storedRsvpFilters = (value: unknown): GuestListFilters['rsvp'] => {
  const entries = Array.isArray(value) ? value : value ? [value] : []
  return entries.filter(
    (entry): entry is GuestListFilters['rsvp'][number] =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { eventId?: unknown }).eventId === 'string' &&
      typeof (entry as { rsvpValue?: unknown }).rsvpValue === 'string'
  )
}

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
        rsvp: storedRsvpFilters(filters.rsvp),
        tagId: storedStrings(filters.tagId),
        country: storedStrings(filters.country),
        side: storedStrings(filters.side),
        group: storedStrings(filters.group),
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
