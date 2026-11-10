import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react'
import { FaMagnifyingGlass } from 'react-icons/fa6'
import { IoIosArrowDown, IoMdCheckmark } from 'react-icons/io'
import { sharedStyles } from '~/app/utils/shared-styles'
import type { Event } from '~/app/utils/shared-types'
import type { GuestListFilters } from '~/components/guest-list/guest-list-view-state'
import { useOuterClick } from '~/components/hooks'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { RSVP_STATUS_LABELS, type RsvpStatus } from '~/lib/constants/rsvp'
import { matchesSearchTerms } from '~/lib/text/normalize'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'
import { api } from '~/trpc/react'

export type TSelectedRsvpFilter = {
  eventId: string
  rsvpValue: string
}

const NO_SIDE_FILTER_KEY = '__no_side__'
const GROUP_SIDE_ORDER = ['חתן', 'כלה', 'ללא צד'] as const
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

const countByNormalizedValue = (values: Array<string | null | undefined>) => {
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

type CountedOption = ReturnType<typeof countByNormalizedValue>[number]

const affiliationSide = (side: string | null | undefined) => {
  const normalizedSide = side?.trim()
  return normalizedSide === 'חתן' || normalizedSide === 'כלה' ? normalizedSide : 'ללא צד'
}

const groupAffiliationsBySide = (households: HouseholdWithGuests[]) => {
  const groupsBySide = new Map<string, Map<string, CountedOption>>()

  for (const side of GROUP_SIDE_ORDER) groupsBySide.set(side, new Map())

  for (const household of households) {
    const label = household.groupName?.trim()
    if (!label) continue

    const sideGroups = groupsBySide.get(affiliationSide(household.side))
    if (!sideGroups) continue

    const key = label.toLowerCase()
    const existing = sideGroups.get(key)
    if (existing) existing.count += 1
    else sideGroups.set(key, { key, label, count: 1 })
  }

  return GROUP_SIDE_ORDER.map((side) => ({
    side,
    groups: Array.from(groupsBySide.get(side)?.values() ?? []).sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'he')
    ),
  })).filter(({ groups }) => groups.length > 0)
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

  const { data: allTags = [] } = api.guestTag.getAll.useQuery()

  const availableCountries = useMemo(() => {
    const countrySet = new Set<string>()
    for (const household of households) {
      if (household.country) countrySet.add(household.country)
    }
    return Array.from(countrySet).sort()
  }, [households])

  const availableSides = useMemo(() => {
    const sides = countByNormalizedValue(households.map((h) => h.side))
    const noSideCount = households.filter((h) => !h.side?.trim()).length
    if (noSideCount > 0) {
      sides.push({ key: NO_SIDE_FILTER_KEY, label: 'ללא צד', count: noSideCount })
    }
    return sides
  }, [households])

  const groupedAffiliations = useMemo(() => groupAffiliationsBySide(households), [households])
  const availableGroups = useMemo(
    () =>
      countByNormalizedValue(households.map((h) => h.groupName)).sort(
        (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'he')
      ),
    [households]
  )

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
      events.some((event) => event.id === filter.eventId)
    )
    const validTagIds = (initialFilters?.tagId ?? []).filter((tagId) =>
      availableTags.some((tag) => tag.id === tagId)
    )
    const countries = (initialFilters?.country ?? []).filter((country) =>
      availableCountries.includes(country)
    )
    const sides = (initialFilters?.side ?? []).filter((side) =>
      availableSides.some((entry) => entry.key === side)
    )
    const groups = (initialFilters?.group ?? []).filter((group) =>
      availableGroups.some((entry) => entry.key === group)
    )
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
    filterHouseholds(search, validRsvp, validTagIds, countries, sides, groups)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchInput(search)
    // Restoration is intentionally keyed to the wedding/event/reset, not to option arrays
    // that can update while the user is actively changing filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, households, resetKey])

  const eventsToMap =
    selectedEventId === 'all' ? events : [events.find((event) => event.id === selectedEventId)]

  const filterHouseholds = (
    searchText: string,
    rsvpFilters: TSelectedRsvpFilter[],
    tagFilters: string[],
    countryFilters: string[],
    sideFilters: string[],
    groupFilters: string[]
  ) => {
    setFilteredHouseholds(() =>
      households.filter((household) => {
        if (countryFilters.length > 0 && !countryFilters.includes(household.country ?? ''))
          return false

        const householdSide = household.side?.trim().toLowerCase() || NO_SIDE_FILTER_KEY
        if (sideFilters.length > 0 && !sideFilters.includes(householdSide)) return false

        if (
          groupFilters.length > 0 &&
          !groupFilters.includes(household.groupName?.trim().toLowerCase() ?? '')
        )
          return false

        if (
          tagFilters.length > 0 &&
          !household.guests.some((guest) =>
            guest.guestTags?.some((tag) => tagFilters.includes(tag.tagId))
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
        const matchesName = matchesSearchTerms(householdSearchHaystack, searchText)

        return household.guests.some((guest) => {
          return rsvpFilters.length > 0
            ? matchesName &&
                guest.invitations?.some((invitation) =>
                  rsvpFilters.some(
                    (filter) =>
                      invitation.eventId === filter.eventId && invitation.rsvp === filter.rsvpValue
                  )
                )
            : matchesName
        })
      })
    )
  }

  const filterHouseholdsBySearch = (searchText: string) => {
    setSearchInput(searchText)
    filterHouseholds(
      searchText,
      selectedRsvpFilters,
      selectedTagFilters,
      selectedCountryFilters,
      selectedSideFilters,
      selectedGroupFilters
    )
  }

  const filterHouseholdsByInvitation = ({ eventId, rsvpValue }: TSelectedRsvpFilter) => {
    const nextFilters = toggleValue(
      selectedRsvpFilters,
      { eventId, rsvpValue },
      (filter) => filter.eventId === eventId && filter.rsvpValue === rsvpValue
    )
    setSelectedRsvpFilters(nextFilters)
    filterHouseholds(
      searchInput,
      nextFilters,
      selectedTagFilters,
      selectedCountryFilters,
      selectedSideFilters,
      selectedGroupFilters
    )
  }

  const filterHouseholdsByTag = (tagId: string) => {
    const nextFilters = toggleValue(selectedTagFilters, tagId)
    setSelectedTagFilters(nextFilters)
    filterHouseholds(
      searchInput,
      selectedRsvpFilters,
      nextFilters,
      selectedCountryFilters,
      selectedSideFilters,
      selectedGroupFilters
    )
  }

  const filterHouseholdsByCountry = (country: string) => {
    const nextFilters = toggleValue(selectedCountryFilters, country)
    setSelectedCountryFilters(nextFilters)
    filterHouseholds(
      searchInput,
      selectedRsvpFilters,
      selectedTagFilters,
      nextFilters,
      selectedSideFilters,
      selectedGroupFilters
    )
  }

  const filterHouseholdsBySide = (sideKey: string) => {
    const nextFilters = toggleValue(selectedSideFilters, sideKey)
    setSelectedSideFilters(nextFilters)
    filterHouseholds(
      searchInput,
      selectedRsvpFilters,
      selectedTagFilters,
      selectedCountryFilters,
      nextFilters,
      selectedGroupFilters
    )
  }

  const filterHouseholdsByGroup = (groupKey: string) => {
    const nextFilters = toggleValue(selectedGroupFilters, groupKey)
    setSelectedGroupFilters(nextFilters)
    filterHouseholds(
      searchInput,
      selectedRsvpFilters,
      selectedTagFilters,
      selectedCountryFilters,
      selectedSideFilters,
      nextFilters
    )
  }

  const clearTagFilter = () => {
    setSelectedTagFilters([])
    filterHouseholds(
      searchInput,
      selectedRsvpFilters,
      [],
      selectedCountryFilters,
      selectedSideFilters,
      selectedGroupFilters
    )
  }

  const clearGroupFilter = () => {
    setSelectedGroupFilters([])
    filterHouseholds(
      searchInput,
      selectedRsvpFilters,
      selectedTagFilters,
      selectedCountryFilters,
      selectedSideFilters,
      []
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
    onFiltersChange?.({
      search: searchInput,
      rsvp: selectedRsvpFilters,
      tagId: selectedTagFilters,
      country: selectedCountryFilters,
      side: selectedSideFilters,
      group: selectedGroupFilters,
    })
  }, [
    onFiltersChange,
    searchInput,
    selectedCountryFilters,
    selectedGroupFilters,
    selectedRsvpFilters,
    selectedSideFilters,
    selectedTagFilters,
  ])

  const clearAllFilters = () => {
    setFilteredHouseholds(households)
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

  const selectedTagLabels = selectedTagFilters.map(
    (tagId) => allTags.find((tag) => tag.id === tagId)?.name ?? tagId
  )
  const selectedSideLabels = selectedSideFilters.map(
    (sideKey) => availableSides.find((side) => side.key === sideKey)?.label ?? sideKey
  )
  const selectedGroupLabels = selectedGroupFilters.map(
    (groupKey) => availableGroups.find((group) => group.key === groupKey)?.label ?? groupKey
  )
  const selectedRsvpLabels = selectedRsvpFilters.map(
    (filter) => RSVP_STATUS_LABELS[filter.rsvpValue as RsvpStatus] ?? filter.rsvpValue
  )
  const selectedSingleRsvp = selectedRsvpFilters.length === 1 ? selectedRsvpFilters[0] : undefined

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
          aria-label='סגירת מסננים'
          className='fixed inset-0 z-40 bg-foreground/35 md:hidden'
          onClick={() => onMobileFiltersOpenChange?.(false)}
        />
      ) : null}
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the responsive container has role=dialog whenever aria-modal is present */}
      <div
        data-testid='affiliation-filter-row'
        role={mobileFiltersOpen ? 'dialog' : undefined}
        aria-modal={mobileFiltersOpen ? true : undefined}
        aria-label={mobileFiltersOpen ? 'סינון אורחים' : undefined}
        className={`${
          mobileFiltersOpen ? 'fixed' : 'hidden'
        } inset-x-0 bottom-0 z-50 ms-auto max-h-[85dvh] flex-col items-stretch justify-end gap-2 overflow-y-auto rounded-t-lg border-t bg-background p-4 shadow-lg md:static md:z-auto md:flex md:w-auto md:max-h-none md:max-w-full md:flex-row md:flex-wrap md:flex-nowrap md:items-center md:justify-start md:ms-0 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none [&>div>div>button]:max-md:min-h-11 [&>div>div>button]:max-md:w-full [&>div_button]:max-md:min-h-11 [&>div_button]:max-md:w-full`}
      >
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
              variant='outline'
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
              <div className='absolute start-0 top-full z-10 mt-1 max-h-64 w-48 overflow-auto rounded-md border bg-popover p-3 shadow-md max-md:static max-md:w-full'>
                <button
                  type='button'
                  className='mb-2 flex w-full items-center justify-between rounded-sm p-2 text-sm transition-colors hover:bg-accent'
                  onClick={() => {
                    setSelectedRsvpFilters([])
                    filterHouseholds(
                      searchInput,
                      [],
                      selectedTagFilters,
                      selectedCountryFilters,
                      selectedSideFilters,
                      selectedGroupFilters
                    )
                  }}
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
                variant='outline'
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
                <div className='absolute start-0 top-full z-10 mt-1 w-64 rounded-md border bg-popover shadow-md max-md:static max-md:w-full'>
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
                variant='outline'
                onClick={() => setShowSideDropdown((prev) => !prev)}
                className='w-32 justify-between font-sans text-sm normal-case tracking-normal'
              >
                <span className='truncate'>{filterButtonLabel('צד', selectedSideLabels)}</span>
                <IoIosArrowDown size={16} />
              </Button>
              {showSideDropdown && (
                <div className='absolute start-0 top-full z-10 mt-1 max-h-64 w-40 overflow-auto rounded-md border bg-popover p-1 shadow-md max-md:static max-md:w-full'>
                  <button
                    type='button'
                    className='flex w-full items-center justify-between rounded-sm p-2 text-sm transition-colors hover:bg-accent'
                    onClick={() => {
                      setSelectedSideFilters([])
                      filterHouseholds(
                        searchInput,
                        selectedRsvpFilters,
                        selectedTagFilters,
                        selectedCountryFilters,
                        [],
                        selectedGroupFilters
                      )
                    }}
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

        {availableGroups.length > 0 && (
          <div ref={groupFilterRef} className='shrink-0'>
            <div className='relative'>
              <Button
                variant='outline'
                onClick={() => {
                  setShowGroupDropdown((prev) => !prev)
                  setGroupSearch('')
                }}
                className='w-36 justify-between font-sans text-sm normal-case tracking-normal'
              >
                <span className='truncate'>{filterButtonLabel('קבוצה', selectedGroupLabels)}</span>
                <IoIosArrowDown size={16} />
              </Button>
              {showGroupDropdown && (
                <div className='absolute start-0 top-full z-10 mt-1 w-80 rounded-md border bg-popover shadow-md max-md:static max-md:w-full'>
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
                      return (
                        <section
                          key={side}
                          aria-label={`קבוצות צד ${side}`}
                          className='border-t py-1'
                        >
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
              variant='outline'
              onClick={() => setShowCountryDropdown((prev) => !prev)}
              className='w-32 justify-between font-sans text-sm normal-case tracking-normal'
            >
              <span className='truncate'>{filterButtonLabel('ארץ', selectedCountryFilters)}</span>
              <IoIosArrowDown size={16} />
            </Button>
            {showCountryDropdown && (
              <div className='absolute start-0 top-full z-10 mt-1 max-h-64 w-40 overflow-auto rounded-md border bg-popover p-1 shadow-md max-md:static max-md:w-full'>
                {availableCountries.length === 0 ? (
                  <p className='px-2 py-1.5 text-muted-foreground text-sm'>לא נמצאו מדינות</p>
                ) : (
                  <>
                    <button
                      type='button'
                      className='flex w-full items-center justify-between rounded-sm p-2 text-sm transition-colors hover:bg-accent'
                      onClick={() => {
                        setSelectedCountryFilters([])
                        filterHouseholds(
                          searchInput,
                          selectedRsvpFilters,
                          selectedTagFilters,
                          [],
                          selectedSideFilters,
                          selectedGroupFilters
                        )
                      }}
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
            <Button type='button' variant='outline' className='min-h-11' onClick={clearAllFilters}>
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

        {hasActiveFilters ? (
          <div
            data-testid='active-filter-chips'
            className='flex min-w-0 flex-1 flex-wrap items-center justify-start gap-2'
          >
            {searchInput ? (
              <button
                type='button'
                className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
                onClick={() => filterHouseholdsBySearch('')}
              >
                חיפוש: {searchInput} ×
              </button>
            ) : null}
            {selectedRsvpFilters.map((filter) => {
              const eventName = events.find((event) => event.id === filter.eventId)?.name
              return (
                <button
                  key={`${filter.eventId}-${filter.rsvpValue}`}
                  type='button'
                  className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
                  onClick={() => filterHouseholdsByInvitation(filter)}
                >
                  סטטוס RSVP:{' '}
                  {RSVP_STATUS_LABELS[filter.rsvpValue as RsvpStatus] ?? filter.rsvpValue}
                  {eventName ? ` (${eventName})` : ''} ×
                </button>
              )
            })}
            {selectedTagFilters.map((tagId) => (
              <button
                key={tagId}
                type='button'
                className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
                onClick={() => filterHouseholdsByTag(tagId)}
              >
                תגית: {allTags.find((tag) => tag.id === tagId)?.name ?? tagId} ×
              </button>
            ))}
            {selectedSideFilters.map((sideKey) => (
              <button
                key={sideKey}
                type='button'
                className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
                onClick={() => filterHouseholdsBySide(sideKey)}
              >
                צד: {availableSides.find((side) => side.key === sideKey)?.label ?? sideKey} ×
              </button>
            ))}
            {selectedGroupFilters.map((groupKey) => (
              <button
                key={groupKey}
                type='button'
                className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
                onClick={() => filterHouseholdsByGroup(groupKey)}
              >
                קבוצה: {availableGroups.find((group) => group.key === groupKey)?.label ?? groupKey}{' '}
                ×
              </button>
            ))}
            {selectedCountryFilters.map((country) => (
              <button
                key={country}
                type='button'
                className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
                onClick={() => filterHouseholdsByCountry(country)}
              >
                ארץ: {country} ×
              </button>
            ))}
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
