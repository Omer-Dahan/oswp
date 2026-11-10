import {
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { FaMagnifyingGlass } from 'react-icons/fa6'
import { IoIosArrowDown, IoMdCheckmark } from 'react-icons/io'
import { sharedStyles } from '~/app/utils/shared-styles'
import type { Event } from '~/app/utils/shared-types'
import {
  affiliationSide,
  applyGuestListFilters,
  GROUP_SIDE_ORDER,
  groupKeyFor,
  NO_SIDE_FILTER_KEY,
} from '~/components/guest-list/guest-list-filtering'
import type { GuestListFilters } from '~/components/guest-list/guest-list-view-state'
import { useOuterClick } from '~/components/hooks'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { RSVP_STATUS_LABELS, type RsvpStatus } from '~/lib/constants/rsvp'
import { forSearch } from '~/lib/text/normalize'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'
import { api } from '~/trpc/react'

export type TSelectedRsvpFilter = {
  eventId: string
  rsvpValue: string
}

const SEARCHABLE_TAG_THRESHOLD = 8

const toggleValue = <T,>(
  values: T[],
  value: T,
  matches: (entry: T) => boolean = (entry) => entry === value
) => (values.some(matches) ? values.filter((entry) => !matches(entry)) : [...values, value])

const filterButtonLabel = (placeholder: string, labels: string[]) => {
  if (labels.length === 0) return placeholder
  return labels.length === 1 ? labels[0] : `${placeholder} · ${labels.length}`
}

const sameValues = <T,>(left: T[], right: T[], key: (value: T) => string) => {
  if (left.length !== right.length) return false
  return left.every((value, index) => {
    const matchingValue = right[index]
    return matchingValue !== undefined && key(value) === key(matchingValue)
  })
}

type CountedOption = { key: string; label: string; count: number }

const countByNormalizedValue = (values: Array<string | null | undefined>): CountedOption[] => {
  const counts = new Map<string, { label: string; count: number }>()
  for (const raw of values) {
    const trimmed = raw?.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    const existing = counts.get(key)
    if (existing) existing.count += 1
    else counts.set(key, { label: trimmed, count: 1 })
  }
  return Array.from(counts.entries())
    .map(([key, { label, count }]) => ({ key, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

type GroupSection = { side: string; groups: CountedOption[] }

/** Builds the full option identity (side sections + group/"no group" keys), independent of counts. */
const groupAffiliationSections = (households: HouseholdWithGuests[]): GroupSection[] => {
  const groupsBySide = new Map<string, Map<string, CountedOption>>()
  const noGroupCountBySide = new Map<string, number>()
  for (const side of GROUP_SIDE_ORDER) {
    groupsBySide.set(side, new Map())
    noGroupCountBySide.set(side, 0)
  }

  for (const household of households) {
    const side = affiliationSide(household.side)
    const label = household.groupName?.trim()
    if (!label) {
      noGroupCountBySide.set(side, (noGroupCountBySide.get(side) ?? 0) + 1)
      continue
    }
    const sideGroups = groupsBySide.get(side)
    if (!sideGroups) continue
    const normalizedKey = forSearch(label)
    const existing = sideGroups.get(normalizedKey)
    if (existing) existing.count += 1
    else sideGroups.set(normalizedKey, { key: groupKeyFor(side, label), label, count: 1 })
  }

  return GROUP_SIDE_ORDER.map((side) => {
    const sortedGroups = Array.from(groupsBySide.get(side)?.values() ?? []).sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'he')
    )
    const noGroupCount = noGroupCountBySide.get(side) ?? 0
    const groups =
      noGroupCount > 0
        ? [
            ...sortedGroups,
            { key: groupKeyFor(side, null), label: 'ללא קבוצה', count: noGroupCount },
          ]
        : sortedGroups
    return { side, groups }
  }).filter(({ groups }) => groups.length > 0)
}

type GuestSearchFilterProps = {
  households: HouseholdWithGuests[]
  setFilteredHouseholds: Dispatch<SetStateAction<HouseholdWithGuests[]>>
  events: Event[]
  selectedEventId: string
  initialFilters?: GuestListFilters
  resetKey?: number
  onFiltersChange?: (filters: GuestListFilters) => void
  mobileFiltersOpen?: boolean
  onMobileFiltersOpenChange?: (open: boolean) => void
}

export default function GuestSearchFilter({
  households,
  setFilteredHouseholds,
  events,
  selectedEventId,
  initialFilters,
  resetKey = 0,
  onFiltersChange,
  mobileFiltersOpen = false,
  onMobileFiltersOpenChange,
}: GuestSearchFilterProps) {
  const [searchInput, setSearchInput] = useState(initialFilters?.search ?? '')
  const [showInvitationDropdown, setShowInvitationDropdown] = useState(false)
  const [selectedRsvpFilters, setSelectedRsvpFilters] = useState<TSelectedRsvpFilter[]>(
    initialFilters?.rsvp ?? []
  )
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>(
    initialFilters?.tagId ?? []
  )
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [selectedCountryFilters, setSelectedCountryFilters] = useState<string[]>(
    initialFilters?.country ?? []
  )
  const [showSideDropdown, setShowSideDropdown] = useState(false)
  const [selectedSideFilters, setSelectedSideFilters] = useState<string[]>(
    initialFilters?.side ?? []
  )
  const [showGroupDropdown, setShowGroupDropdown] = useState(false)
  const [groupSearch, setGroupSearch] = useState('')
  const [selectedGroupFilters, setSelectedGroupFilters] = useState<string[]>(
    initialFilters?.group ?? []
  )

  const invitationFilterRef = useOuterClick(() => setShowInvitationDropdown(false))
  const tagFilterRef = useOuterClick(() => setShowTagDropdown(false))
  const countryFilterRef = useOuterClick(() => setShowCountryDropdown(false))
  const sideFilterRef = useOuterClick(() => setShowSideDropdown(false))
  const groupFilterRef = useOuterClick(() => setShowGroupDropdown(false))

  const invitationTriggerRef = useRef<HTMLButtonElement>(null)
  const tagTriggerRef = useRef<HTMLButtonElement>(null)
  const countryTriggerRef = useRef<HTMLButtonElement>(null)
  const sideTriggerRef = useRef<HTMLButtonElement>(null)
  const groupTriggerRef = useRef<HTMLButtonElement>(null)
  const filterRowRef = useRef<HTMLDivElement>(null)

  const { data: allTags = [], isLoading: isTagsLoading } = api.guestTag.getAll.useQuery()

  const availableCountries = useMemo(() => {
    const countrySet = new Set<string>()
    for (const household of households) {
      if (household.country) countrySet.add(household.country)
    }
    return Array.from(countrySet).sort()
  }, [households])

  const currentFilters: GuestListFilters = useMemo(
    () => ({
      search: searchInput,
      rsvp: selectedRsvpFilters,
      tagId: selectedTagFilters,
      country: selectedCountryFilters,
      side: selectedSideFilters,
      group: selectedGroupFilters,
    }),
    [
      searchInput,
      selectedRsvpFilters,
      selectedTagFilters,
      selectedCountryFilters,
      selectedSideFilters,
      selectedGroupFilters,
    ]
  )

  const filteredHouseholds = useMemo(
    () => applyGuestListFilters(households, currentFilters),
    [households, currentFilters]
  )

  useEffect(() => {
    setFilteredHouseholds(filteredHouseholds)
  }, [filteredHouseholds, setFilteredHouseholds])

  const availableSides = useMemo(() => {
    const optionList = countByNormalizedValue(households.map((h) => h.side))
    const noSideCount = households.filter((h) => !h.side?.trim()).length
    return noSideCount > 0
      ? [...optionList, { key: NO_SIDE_FILTER_KEY, label: 'ללא צד', count: noSideCount }]
      : optionList
  }, [households])

  const groupedAffiliations = useMemo(() => groupAffiliationSections(households), [households])

  const groupOptionsByKey = useMemo(() => {
    const map = new Map<string, { label: string; side: string }>()
    for (const { side, groups } of groupedAffiliations) {
      for (const group of groups) map.set(group.key, { label: group.label, side })
    }
    return map
  }, [groupedAffiliations])

  const hasGroupOptions = groupedAffiliations.some((section) => section.groups.length > 0)

  const availableTagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const household of households) {
      const tagIdsInHousehold = new Set<string>()
      for (const guest of household.guests) {
        for (const guestTag of guest.guestTags ?? []) {
          tagIdsInHousehold.add(guestTag.tagId)
        }
      }
      for (const tagId of tagIdsInHousehold) {
        counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
      }
    }
    return counts
  }, [households])

  const availableTags = useMemo(
    () =>
      allTags
        .filter((tag) => (availableTagCounts.get(tag.id) ?? 0) > 0)
        .sort(
          (a, b) =>
            (availableTagCounts.get(b.id) ?? 0) - (availableTagCounts.get(a.id) ?? 0) ||
            a.name.localeCompare(b.name, 'he')
        ),
    [allTags, availableTagCounts]
  )

  const filteredGroupSections = useMemo(() => {
    const normalizedSearch = groupSearch.trim().toLowerCase()
    if (!normalizedSearch) return groupedAffiliations
    return groupedAffiliations
      .map((section) => ({
        ...section,
        groups: section.groups.filter((group) =>
          group.label.toLowerCase().includes(normalizedSearch)
        ),
      }))
      .filter(({ groups }) => groups.length > 0)
  }, [groupSearch, groupedAffiliations])

  const filteredTags = useMemo(() => {
    const normalizedSearch = tagSearch.trim().toLowerCase()
    if (!normalizedSearch) return availableTags
    return availableTags.filter((tag) => tag.name.toLowerCase().includes(normalizedSearch))
  }, [availableTags, tagSearch])

  // biome-ignore lint/correctness/useExhaustiveDependencies: restore only when the event, data source, or explicit reset changes
  useEffect(() => {
    // Reset filters when event context changes so state never carries hidden stale constraints.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const validRsvp = (initialFilters?.rsvp ?? []).filter((filter) =>
      selectedEventId === 'all'
        ? events.some((event) => event.id === filter.eventId)
        : filter.eventId === selectedEventId
    )
    // A tag query still in flight has no `availableTags` yet - keep whatever
    // was restored as-is rather than wiping it, and let the dedicated
    // re-validation effect below prune it once the query actually lands.
    const validTagIds = isTagsLoading
      ? (initialFilters?.tagId ?? [])
      : (initialFilters?.tagId ?? []).filter((tagId) =>
          availableTags.some((tag) => tag.id === tagId)
        )
    const countries = (initialFilters?.country ?? []).filter((country) =>
      availableCountries.includes(country)
    )
    const sides = (initialFilters?.side ?? []).filter((side) =>
      availableSides.some((entry) => entry.key === side)
    )
    const groups = (initialFilters?.group ?? []).filter((group) => groupOptionsByKey.has(group))
    const search = initialFilters?.search ?? ''
    setSelectedRsvpFilters((current) =>
      sameValues(current, validRsvp, (filter) => `${filter.eventId}:${filter.rsvpValue}`)
        ? current
        : validRsvp
    )
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedTagFilters((current) =>
      sameValues(current, validTagIds, String) ? current : validTagIds
    )
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCountryFilters((current) =>
      sameValues(current, countries, String) ? current : countries
    )
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedSideFilters((current) => (sameValues(current, sides, String) ? current : sides))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedGroupFilters((current) => (sameValues(current, groups, String) ? current : groups))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchInput(search)
    // Restoration is intentionally keyed to the wedding/event/reset, not to option arrays
    // that can update while the user is actively changing filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, households, resetKey])

  // Finding #6: once the tag query actually resolves, drop any tag id that
  // turned out not to exist - but never before then.
  useEffect(() => {
    if (isTagsLoading) return
    setSelectedTagFilters((current) => {
      const next = current.filter((tagId) => availableTags.some((tag) => tag.id === tagId))
      return sameValues(current, next, String) ? current : next
    })
  }, [isTagsLoading, availableTags])

  const eventsToMap =
    selectedEventId === 'all' ? events : [events.find((event) => event.id === selectedEventId)]

  const clearTagFilter = () => setSelectedTagFilters([])
  const clearGroupFilter = () => setSelectedGroupFilters([])
  const clearSideFilter = () => setSelectedSideFilters([])
  const clearCountryFilter = () => setSelectedCountryFilters([])
  const clearRsvpFilter = () => setSelectedRsvpFilters([])

  const filterHouseholdsBySearch = (searchText: string) => setSearchInput(searchText)

  const filterHouseholdsByInvitation = ({ eventId, rsvpValue }: TSelectedRsvpFilter) => {
    setSelectedRsvpFilters((current) =>
      toggleValue(
        current,
        { eventId, rsvpValue },
        (filter) => filter.eventId === eventId && filter.rsvpValue === rsvpValue
      )
    )
  }

  const filterHouseholdsByTag = (tagId: string) =>
    setSelectedTagFilters((current) => toggleValue(current, tagId))

  const filterHouseholdsByCountry = (country: string) =>
    setSelectedCountryFilters((current) => toggleValue(current, country))

  const filterHouseholdsBySide = (sideKey: string) =>
    setSelectedSideFilters((current) => toggleValue(current, sideKey))

  const filterHouseholdsByGroup = (groupKey: string) =>
    setSelectedGroupFilters((current) => toggleValue(current, groupKey))

  // Finding #18: select (or clear) every group on one side of the aisle at once.
  const toggleWholeSide = (side: string) => {
    const sideGroupKeys = groupedAffiliations
      .find((section) => section.side === side)
      ?.groups.map((group) => group.key)
    if (!sideGroupKeys || sideGroupKeys.length === 0) return
    const allSelected = sideGroupKeys.every((key) => selectedGroupFilters.includes(key))
    setSelectedGroupFilters((current) =>
      allSelected
        ? current.filter((key) => !sideGroupKeys.includes(key))
        : Array.from(new Set([...current, ...sideGroupKeys]))
    )
  }

  const hasActiveFilters =
    selectedRsvpFilters.length > 0 ||
    selectedTagFilters.length > 0 ||
    selectedCountryFilters.length > 0 ||
    selectedSideFilters.length > 0 ||
    selectedGroupFilters.length > 0 ||
    !!searchInput

  useEffect(() => {
    onFiltersChange?.(currentFilters)
  }, [onFiltersChange, currentFilters])

  const clearAllFilters = () => {
    setSearchInput('')
    setSelectedRsvpFilters([])
    setSelectedTagFilters([])
    setSelectedCountryFilters([])
    setSelectedSideFilters([])
    setSelectedGroupFilters([])
  }

  useEffect(() => {
    if (!mobileFiltersOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileFiltersOpenChange?.(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileFiltersOpen, onMobileFiltersOpenChange])

  // Finding #13: trap focus inside the mobile sheet while it's open, so Tab
  // never escapes to the backdrop/background content behind it.
  useEffect(() => {
    if (!mobileFiltersOpen) return
    const container = filterRowRef.current
    if (!container) return

    const getFocusable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )

    getFocusable()[0]?.focus()

    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const focusable = getFocusable()
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', trapTab)
    return () => document.removeEventListener('keydown', trapTab)
  }, [mobileFiltersOpen])

  // Finding #13/#20: Escape closes an open desktop dropdown and returns focus
  // to its trigger; ArrowUp/ArrowDown move focus between its options.
  const makeDropdownKeyDown =
    (close: () => void, triggerRef: RefObject<HTMLButtonElement | null>) =>
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
        triggerRef.current?.focus()
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      event.preventDefault()
      const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
      if (options.length === 0) return
      const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement)
      const nextIndex =
        event.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, options.length - 1)
          : Math.max(currentIndex - 1, 0)
      options[nextIndex]?.focus()
    }

  const selectedTagLabels = selectedTagFilters.map(
    (tagId) => allTags.find((tag) => tag.id === tagId)?.name ?? tagId
  )
  const selectedSideLabels = selectedSideFilters.map(
    (sideKey) => availableSides.find((side) => side.key === sideKey)?.label ?? sideKey
  )
  const selectedGroupLabels = selectedGroupFilters.map((groupKey) => {
    const entry = groupOptionsByKey.get(groupKey)
    return entry ? `${entry.label} · ${entry.side}` : groupKey
  })
  const selectedRsvpLabels = selectedRsvpFilters.map(
    (filter) => RSVP_STATUS_LABELS[filter.rsvpValue as RsvpStatus] ?? filter.rsvpValue
  )
  const selectedSingleRsvp = selectedRsvpFilters.length === 1 ? selectedRsvpFilters[0] : undefined

  const activeFilterChips = hasActiveFilters ? (
    <>
      {searchInput ? (
        <button
          type='button'
          aria-label={`הסרת סינון חיפוש: ${searchInput}`}
          className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
          onClick={() => filterHouseholdsBySearch('')}
        >
          חיפוש: {searchInput} ×
        </button>
      ) : null}
      {selectedRsvpFilters.map((filter) => {
        const eventName = events.find((event) => event.id === filter.eventId)?.name
        const label = RSVP_STATUS_LABELS[filter.rsvpValue as RsvpStatus] ?? filter.rsvpValue
        return (
          <button
            key={`${filter.eventId}-${filter.rsvpValue}`}
            type='button'
            aria-label={`הסרת סינון סטטוס RSVP: ${label}${eventName ? ` (${eventName})` : ''}`}
            className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
            onClick={() => filterHouseholdsByInvitation(filter)}
          >
            סטטוס RSVP: {label}
            {eventName ? ` (${eventName})` : ''} ×
          </button>
        )
      })}
      {selectedTagFilters.map((tagId) => {
        const tagName = allTags.find((tag) => tag.id === tagId)?.name ?? tagId
        return (
          <button
            key={tagId}
            type='button'
            aria-label={`הסרת סינון תגית: ${tagName}`}
            className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
            onClick={() => filterHouseholdsByTag(tagId)}
          >
            תגית: {tagName} ×
          </button>
        )
      })}
      {selectedSideFilters.map((sideKey) => {
        const label = availableSides.find((side) => side.key === sideKey)?.label ?? sideKey
        return (
          <button
            key={sideKey}
            type='button'
            aria-label={`הסרת סינון צד: ${label}`}
            className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
            onClick={() => filterHouseholdsBySide(sideKey)}
          >
            צד: {label} ×
          </button>
        )
      })}
      {selectedGroupFilters.map((groupKey) => {
        const entry = groupOptionsByKey.get(groupKey)
        const label = entry ? `${entry.label} · ${entry.side}` : groupKey
        return (
          <button
            key={groupKey}
            type='button'
            aria-label={`הסרת סינון קבוצה: ${label}`}
            className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
            onClick={() => filterHouseholdsByGroup(groupKey)}
          >
            קבוצה: {label} ×
          </button>
        )
      })}
      {selectedCountryFilters.map((country) => (
        <button
          key={country}
          type='button'
          aria-label={`הסרת סינון ארץ: ${country}`}
          className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
          onClick={() => filterHouseholdsByCountry(country)}
        >
          ארץ: {country} ×
        </button>
      ))}
    </>
  ) : null

  return (
    <div className='flex w-full flex-col gap-3'>
      <div className='flex w-full justify-start md:w-auto'>
        <div className='relative flex w-full items-center md:w-auto'>
          <Input
            id='search-guests-input'
            className='h-11 w-full pe-12 font-sans text-sm md:h-10 md:w-64'
            placeholder='חיפוש אורחים'
            value={searchInput}
            onChange={(e) => filterHouseholdsBySearch(e.target.value)}
          />
          <button
            type='button'
            aria-label='חיפוש אורחים'
            className='absolute end-0 flex h-11 w-12 items-center justify-center rounded-e-md bg-primary md:h-10'
          >
            <FaMagnifyingGlass className='text-primary-foreground' size={18} />
          </button>
        </div>
      </div>

      {mobileFiltersOpen ? (
        <button
          type='button'
          tabIndex={-1}
          aria-label='סגירת מסננים'
          className='fixed inset-0 z-40 bg-foreground/35 md:hidden'
          onClick={() => onMobileFiltersOpenChange?.(false)}
        />
      ) : null}
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the responsive container has role=dialog whenever aria-modal is present */}
      <div
        ref={filterRowRef}
        data-testid='affiliation-filter-row'
        role={mobileFiltersOpen ? 'dialog' : undefined}
        aria-modal={mobileFiltersOpen ? true : undefined}
        aria-label={mobileFiltersOpen ? 'סינון אורחים' : undefined}
        className={`ms-auto flex flex-col items-stretch justify-end gap-2 ${
          mobileFiltersOpen
            ? 'fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-lg border-t bg-background p-4 shadow-lg'
            : ''
        } md:static md:z-auto md:ms-0 md:flex md:max-h-none md:w-auto md:max-w-full md:flex-row md:flex-nowrap md:items-center md:justify-start md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none [&>div>div>button]:max-md:min-h-11 [&>div>div>button]:max-md:w-full [&>div_button]:max-md:min-h-11 [&>div_button]:max-md:w-full [@media(min-width:768px)_and_(max-width:1000px)]:flex-wrap`}
      >
        {/* Finding #8: the five filter triggers (and the mobile sheet's own
            header/apply controls) only matter once the sheet is open on
            mobile; the active-filter chips below stay a sibling so they
            render on mobile even while this stays hidden. */}
        <div className={`${mobileFiltersOpen ? 'contents' : 'hidden'} md:contents`}>
          {mobileFiltersOpen ? (
            <div className='mb-2 flex items-center justify-between md:hidden'>
              <p className='font-mono text-sm'>סינון אורחים</p>
              <button
                type='button'
                className='flex min-h-11 min-w-11 items-center justify-center text-xl'
                aria-label='סגירת מסננים'
                onClick={() => onMobileFiltersOpenChange?.(false)}
              >
                ×
              </button>
            </div>
          ) : null}
          <div ref={invitationFilterRef} className='shrink-0'>
            <div className='relative'>
              <Button
                ref={invitationTriggerRef}
                variant='outline'
                aria-haspopup='listbox'
                aria-expanded={showInvitationDropdown}
                onClick={() => setShowInvitationDropdown((prev) => !prev)}
                className='w-40 justify-between font-sans text-sm normal-case tracking-normal'
              >
                {selectedSingleRsvp ? (
                  <div className='flex items-center gap-1.5'>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${sharedStyles.getRSVPcolor(
                        selectedSingleRsvp.rsvpValue
                      )}`}
                    />
                    <span className='truncate'>{selectedRsvpLabels[0]}</span>
                  </div>
                ) : (
                  <span>{filterButtonLabel('סטטוס RSVP', selectedRsvpLabels)}</span>
                )}
                <IoIosArrowDown size={16} />
              </Button>
              {showInvitationDropdown && (
                // biome-ignore lint/a11y/noStaticElementInteractions: the onKeyDown only adds Escape/arrow-key convenience on top of fully keyboard-accessible <button> options; it never replaces native interaction
                <div
                  className='absolute start-0 top-full z-10 mt-1 max-h-64 w-48 overflow-auto rounded-md border bg-popover p-3 shadow-md max-md:static max-md:w-full'
                  onKeyDown={makeDropdownKeyDown(
                    () => setShowInvitationDropdown(false),
                    invitationTriggerRef
                  )}
                >
                  <button
                    type='button'
                    aria-pressed={selectedRsvpFilters.length === 0}
                    className='mb-2 flex w-full items-center justify-between rounded-sm p-2 text-sm transition-colors hover:bg-accent'
                    onClick={clearRsvpFilter}
                  >
                    <span>הכל</span>
                    {selectedRsvpFilters.length === 0 ? (
                      <IoMdCheckmark size={16} className='text-primary' />
                    ) : null}
                  </button>
                  {eventsToMap?.map(
                    (event) =>
                      event && (
                        <div
                          key={event.id}
                          className='mb-4 flex flex-col border-b pb-2 last:mb-0 last:border-0'
                        >
                          <h5 className='mb-2 font-medium text-muted-foreground text-xs uppercase'>
                            {event.name}
                          </h5>
                          {['Not Invited', 'Invited', 'Attending', 'Declined'].map((rsvp) => (
                            <InvitationOption
                              key={rsvp}
                              rsvpValue={rsvp}
                              eventId={event.id}
                              filterHouseholdsByInvitation={filterHouseholdsByInvitation}
                              isSelected={selectedRsvpFilters.some(
                                (filter) => event.id === filter.eventId && rsvp === filter.rsvpValue
                              )}
                            />
                          ))}
                        </div>
                      )
                  )}
                </div>
              )}
            </div>
          </div>

          {availableTags.length > 0 && (
            <div ref={tagFilterRef} className='shrink-0'>
              <div className='relative'>
                <Button
                  ref={tagTriggerRef}
                  variant='outline'
                  aria-haspopup='listbox'
                  aria-expanded={showTagDropdown}
                  onClick={() => {
                    setShowTagDropdown((prev) => !prev)
                    setTagSearch('')
                  }}
                  className='w-36 justify-between font-sans text-sm normal-case tracking-normal'
                >
                  <span className='truncate'>
                    {filterButtonLabel('תגית אורח', selectedTagLabels)}
                  </span>
                  <IoIosArrowDown size={16} />
                </Button>
                {showTagDropdown && (
                  // biome-ignore lint/a11y/noStaticElementInteractions: the onKeyDown only adds Escape/arrow-key convenience on top of fully keyboard-accessible <button> options; it never replaces native interaction
                  <div
                    className='absolute start-0 top-full z-10 mt-1 w-64 rounded-md border bg-popover shadow-md max-md:static max-md:w-full'
                    onKeyDown={makeDropdownKeyDown(() => setShowTagDropdown(false), tagTriggerRef)}
                  >
                    {availableTags.length > SEARCHABLE_TAG_THRESHOLD ? (
                      <div className='border-b p-2'>
                        <Input
                          aria-label='חיפוש תגית'
                          placeholder='חיפוש תגית'
                          value={tagSearch}
                          onChange={(event) => setTagSearch(event.target.value)}
                          className='h-9 font-sans text-sm'
                          autoFocus
                        />
                      </div>
                    ) : null}
                    <div className='max-h-64 overflow-y-auto p-1'>
                      <button
                        type='button'
                        aria-pressed={selectedTagFilters.length === 0}
                        className='flex w-full items-center justify-between rounded-sm p-2 text-sm transition-colors hover:bg-accent'
                        onClick={clearTagFilter}
                      >
                        <span>הכל</span>
                        {selectedTagFilters.length === 0 ? (
                          <IoMdCheckmark size={16} className='text-primary' />
                        ) : null}
                      </button>
                      {filteredTags.map((tag) => (
                        <button
                          key={tag.id}
                          type='button'
                          aria-pressed={selectedTagFilters.includes(tag.id)}
                          className='flex w-full cursor-pointer items-center justify-between rounded-sm p-2 text-sm transition-colors hover:bg-accent'
                          onClick={() => filterHouseholdsByTag(tag.id)}
                        >
                          <span>
                            {tag.name} ({availableTagCounts.get(tag.id) ?? 0})
                          </span>
                          {selectedTagFilters.includes(tag.id) && (
                            <IoMdCheckmark size={16} className='text-primary' />
                          )}
                        </button>
                      ))}
                      {filteredTags.length === 0 ? (
                        <p className='px-2 py-5 text-center text-muted-foreground text-sm'>
                          לא נמצאה תגית בשם הזה
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {availableSides.length > 0 && (
            <div ref={sideFilterRef} className='shrink-0'>
              <div className='relative'>
                <Button
                  ref={sideTriggerRef}
                  variant='outline'
                  aria-haspopup='listbox'
                  aria-expanded={showSideDropdown}
                  onClick={() => setShowSideDropdown((prev) => !prev)}
                  className='w-32 justify-between font-sans text-sm normal-case tracking-normal'
                >
                  <span className='truncate'>{filterButtonLabel('צד', selectedSideLabels)}</span>
                  <IoIosArrowDown size={16} />
                </Button>
                {showSideDropdown && (
                  // biome-ignore lint/a11y/noStaticElementInteractions: the onKeyDown only adds Escape/arrow-key convenience on top of fully keyboard-accessible <button> options; it never replaces native interaction
                  <div
                    className='absolute start-0 top-full z-10 mt-1 max-h-64 w-40 overflow-auto rounded-md border bg-popover p-1 shadow-md max-md:static max-md:w-full'
                    onKeyDown={makeDropdownKeyDown(
                      () => setShowSideDropdown(false),
                      sideTriggerRef
                    )}
                  >
                    <button
                      type='button'
                      aria-pressed={selectedSideFilters.length === 0}
                      className='flex w-full items-center justify-between rounded-sm p-2 text-sm transition-colors hover:bg-accent'
                      onClick={clearSideFilter}
                    >
                      <span>הכל</span>
                      {selectedSideFilters.length === 0 ? (
                        <IoMdCheckmark size={16} className='text-primary' />
                      ) : null}
                    </button>
                    {availableSides.map((side) => (
                      <button
                        key={side.key}
                        type='button'
                        aria-pressed={selectedSideFilters.includes(side.key)}
                        className='flex w-full cursor-pointer items-center justify-between rounded-sm p-2 text-sm transition-colors hover:bg-accent'
                        onClick={() => filterHouseholdsBySide(side.key)}
                      >
                        <span>
                          {side.label} ({side.count})
                        </span>
                        {selectedSideFilters.includes(side.key) && (
                          <IoMdCheckmark size={16} className='text-primary' />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {hasGroupOptions && (
            <div ref={groupFilterRef} className='shrink-0'>
              <div className='relative'>
                <Button
                  ref={groupTriggerRef}
                  variant='outline'
                  aria-haspopup='listbox'
                  aria-expanded={showGroupDropdown}
                  onClick={() => {
                    setShowGroupDropdown((prev) => !prev)
                    setGroupSearch('')
                  }}
                  className='w-36 justify-between font-sans text-sm normal-case tracking-normal'
                >
                  <span className='truncate'>
                    {filterButtonLabel('קבוצה', selectedGroupLabels)}
                  </span>
                  <IoIosArrowDown size={16} />
                </Button>
                {showGroupDropdown && (
                  // biome-ignore lint/a11y/noStaticElementInteractions: the onKeyDown only adds Escape/arrow-key convenience on top of fully keyboard-accessible <button> options; it never replaces native interaction
                  <div
                    className='absolute start-0 top-full z-10 mt-1 w-80 rounded-md border bg-popover shadow-md max-md:static max-md:w-full'
                    onKeyDown={makeDropdownKeyDown(
                      () => setShowGroupDropdown(false),
                      groupTriggerRef
                    )}
                  >
                    <div className='border-b p-2'>
                      <Input
                        aria-label='חיפוש קבוצה'
                        placeholder='חיפוש קבוצה'
                        value={groupSearch}
                        onChange={(event) => setGroupSearch(event.target.value)}
                        className='h-9 font-sans text-sm'
                        autoFocus
                      />
                    </div>
                    <div className='max-h-[min(28rem,calc(100vh-12rem))] overflow-y-auto p-1'>
                      <button
                        type='button'
                        aria-pressed={selectedGroupFilters.length === 0}
                        className='flex w-full cursor-pointer items-center justify-between rounded-sm p-2 text-sm transition-colors hover:bg-accent'
                        onClick={clearGroupFilter}
                      >
                        <span>הכל</span>
                        {selectedGroupFilters.length === 0 ? (
                          <IoMdCheckmark size={16} className='text-primary' />
                        ) : null}
                      </button>
                      {filteredGroupSections.map(({ side, groups }) => {
                        const householdCount = groups.reduce((sum, group) => sum + group.count, 0)
                        const sideGroupKeys =
                          groupedAffiliations
                            .find((section) => section.side === side)
                            ?.groups.map((group) => group.key) ?? []
                        const allSideSelected =
                          sideGroupKeys.length > 0 &&
                          sideGroupKeys.every((key) => selectedGroupFilters.includes(key))
                        return (
                          <div key={side}>
                            <button
                              type='button'
                              aria-pressed={allSideSelected}
                              className='flex w-full items-center justify-end gap-1 px-2 pt-1.5 text-primary text-xs underline-offset-2 hover:underline'
                              onClick={() => toggleWholeSide(side)}
                            >
                              {allSideSelected
                                ? `ביטול בחירת כל הצד · ${side}`
                                : `בחירת כל הצד · ${side}`}
                            </button>
                            <section aria-label={`קבוצות צד ${side}`} className='border-t py-1'>
                              <div className='flex items-center justify-between px-2 py-1.5 text-muted-foreground text-xs'>
                                <span className='font-medium text-foreground'>{side}</span>
                                <span>
                                  {groups.length} קבוצות · {householdCount} משקי בית
                                </span>
                              </div>
                              {groups.map((group) => (
                                <button
                                  key={`${side}-${group.key}`}
                                  type='button'
                                  aria-pressed={selectedGroupFilters.includes(group.key)}
                                  className='flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-2 text-sm transition-colors hover:bg-accent'
                                  onClick={() => filterHouseholdsByGroup(group.key)}
                                >
                                  <span>
                                    {group.label} ({group.count})
                                  </span>
                                  {selectedGroupFilters.includes(group.key) ? (
                                    <IoMdCheckmark size={16} className='text-primary' />
                                  ) : null}
                                </button>
                              ))}
                            </section>
                          </div>
                        )
                      })}
                      {filteredGroupSections.length === 0 ? (
                        <p className='px-2 py-8 text-center text-muted-foreground text-sm'>
                          לא נמצאה קבוצה בשם הזה
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={countryFilterRef} className='shrink-0'>
            <div className='relative'>
              <Button
                ref={countryTriggerRef}
                variant='outline'
                aria-haspopup='listbox'
                aria-expanded={showCountryDropdown}
                onClick={() => setShowCountryDropdown((prev) => !prev)}
                className='w-32 justify-between font-sans text-sm normal-case tracking-normal'
              >
                <span className='truncate'>{filterButtonLabel('ארץ', selectedCountryFilters)}</span>
                <IoIosArrowDown size={16} />
              </Button>
              {showCountryDropdown && (
                // biome-ignore lint/a11y/noStaticElementInteractions: the onKeyDown only adds Escape/arrow-key convenience on top of fully keyboard-accessible <button> options; it never replaces native interaction
                <div
                  className='absolute start-0 top-full z-10 mt-1 max-h-64 w-40 overflow-auto rounded-md border bg-popover p-1 shadow-md max-md:static max-md:w-full'
                  onKeyDown={makeDropdownKeyDown(
                    () => setShowCountryDropdown(false),
                    countryTriggerRef
                  )}
                >
                  {availableCountries.length === 0 ? (
                    <p className='px-2 py-1.5 text-muted-foreground text-sm'>לא נמצאו מדינות</p>
                  ) : (
                    <>
                      <button
                        type='button'
                        aria-pressed={selectedCountryFilters.length === 0}
                        className='flex w-full items-center justify-between rounded-sm p-2 text-sm transition-colors hover:bg-accent'
                        onClick={clearCountryFilter}
                      >
                        <span>הכל</span>
                        {selectedCountryFilters.length === 0 ? (
                          <IoMdCheckmark size={16} className='text-primary' />
                        ) : null}
                      </button>
                      {availableCountries.map((country) => (
                        <button
                          key={country}
                          type='button'
                          aria-pressed={selectedCountryFilters.includes(country)}
                          className='flex w-full cursor-pointer items-center justify-between rounded-sm p-2 text-sm transition-colors hover:bg-accent'
                          onClick={() => filterHouseholdsByCountry(country)}
                        >
                          <span>{country}</span>
                          {selectedCountryFilters.includes(country) && (
                            <IoMdCheckmark size={16} className='text-primary' />
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {mobileFiltersOpen ? (
            <div className='mt-3 grid grid-cols-2 gap-2 border-t pt-4 md:hidden'>
              <Button
                type='button'
                variant='outline'
                className='min-h-11'
                onClick={clearAllFilters}
              >
                איפוס
              </Button>
              <Button
                type='button'
                className='min-h-11'
                onClick={() => onMobileFiltersOpenChange?.(false)}
              >
                החל
              </Button>
            </div>
          ) : null}
        </div>

        {hasActiveFilters ? (
          <div
            data-testid='active-filter-chips'
            className='flex min-w-0 flex-1 flex-wrap items-center justify-start gap-2'
          >
            {activeFilterChips}
            <Button
              variant='ghost'
              size='sm'
              className='shrink-0 font-sans text-primary text-sm normal-case tracking-normal'
              onClick={clearAllFilters}
            >
              איפוס
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

type InvitationOptionProps = {
  rsvpValue: string
  eventId: string
  filterHouseholdsByInvitation: (filter: TSelectedRsvpFilter) => void
  isSelected: boolean
}

const InvitationOption = ({
  rsvpValue,
  eventId,
  filterHouseholdsByInvitation,
  isSelected,
}: InvitationOptionProps) => {
  const handleChangeOption = () => {
    filterHouseholdsByInvitation({ eventId, rsvpValue })
  }

  return (
    <button
      type='button'
      aria-pressed={isSelected}
      className='flex w-full cursor-pointer items-center justify-between rounded-sm p-2 text-sm transition-colors hover:bg-accent'
      onClick={handleChangeOption}
    >
      <div className='flex items-center gap-1.5'>
        <span className={`h-1.5 w-1.5 rounded-full ${sharedStyles.getRSVPcolor(rsvpValue)}`} />
        <span>{RSVP_STATUS_LABELS[rsvpValue as RsvpStatus] ?? rsvpValue}</span>
      </div>
      {isSelected && <IoMdCheckmark size={16} className='text-primary' />}
    </button>
  )
}
