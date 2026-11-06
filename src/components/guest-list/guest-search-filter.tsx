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
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'
import { api } from '~/trpc/react'

type TSelectedRsvpFilter = {
  eventId: string
  rsvpValue: string
}

const NO_SIDE_FILTER_KEY = '__no_side__'
const GROUP_SIDE_ORDER = ['חתן', 'כלה', 'ללא צד'] as const
const SEARCHABLE_TAG_THRESHOLD = 8

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
  const [selectedRsvpFilter, setSelectedRsvpFilter] = useState<TSelectedRsvpFilter | null>(
    initialFilters?.rsvp ?? null
  )
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(
    initialFilters?.tagId ?? null
  )
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string | null>(
    initialFilters?.country ?? null
  )
  const [showSideDropdown, setShowSideDropdown] = useState(false)
  const [selectedSideFilter, setSelectedSideFilter] = useState<string | null>(
    initialFilters?.side ?? null
  )
  const [showGroupDropdown, setShowGroupDropdown] = useState(false)
  const [groupSearch, setGroupSearch] = useState('')
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(
    initialFilters?.group ?? null
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
    const rsvp = initialFilters?.rsvp
    const validRsvp = rsvp && events.some((event) => event.id === rsvp.eventId) ? rsvp : null
    const tagId = initialFilters?.tagId
    const validTagId = tagId && availableTags.some((tag) => tag.id === tagId) ? tagId : null
    const country = availableCountries.includes(initialFilters?.country ?? '')
      ? (initialFilters?.country ?? null)
      : null
    const side = availableSides.some((entry) => entry.key === initialFilters?.side)
      ? (initialFilters?.side ?? null)
      : null
    const group = availableGroups.some((entry) => entry.key === initialFilters?.group)
      ? (initialFilters?.group ?? null)
      : null
    const search = initialFilters?.search ?? ''
    setSelectedRsvpFilter(validRsvp)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedTagFilter(validTagId)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCountryFilter(country)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedSideFilter(side)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedGroupFilter(group)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    filterHouseholds(search, validRsvp, validTagId, country, side, group)
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
    rsvpFilter: TSelectedRsvpFilter | null,
    tagFilter: string | null,
    countryFilter: string | null,
    sideFilter: string | null,
    groupFilter: string | null
  ) => {
    const normalizedSearch = searchText.toLowerCase()
    setFilteredHouseholds(() =>
      households.filter((household) => {
        if (countryFilter && household.country !== countryFilter) return false

        if (sideFilter) {
          if (sideFilter === NO_SIDE_FILTER_KEY) {
            if (household.side?.trim()) return false
          } else if (household.side?.trim().toLowerCase() !== sideFilter) {
            return false
          }
        }

        if (groupFilter && household.groupName?.trim().toLowerCase() !== groupFilter) return false

        if (
          tagFilter &&
          !household.guests.some((g) => g.guestTags?.some((t) => t.tagId === tagFilter))
        ) {
          return false
        }

        return household.guests.some((guest) => {
          const fullName = `${guest.firstName} ${guest.lastName}`.toLowerCase()
          const matchesName =
            guest.firstName.toLowerCase().includes(normalizedSearch) ||
            guest.lastName.toLowerCase().includes(normalizedSearch) ||
            fullName.includes(normalizedSearch)
          return rsvpFilter
            ? matchesName &&
                guest.invitations?.some(
                  (inv) => inv.eventId === rsvpFilter?.eventId && inv.rsvp === rsvpFilter?.rsvpValue
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
      selectedRsvpFilter,
      selectedTagFilter,
      selectedCountryFilter,
      selectedSideFilter,
      selectedGroupFilter
    )
  }

  const filterHouseholdsByInvitation = ({ eventId, rsvpValue }: TSelectedRsvpFilter) => {
    setShowInvitationDropdown(false)
    setSelectedRsvpFilter({ eventId, rsvpValue })
    filterHouseholds(
      searchInput,
      { eventId, rsvpValue },
      selectedTagFilter,
      selectedCountryFilter,
      selectedSideFilter,
      selectedGroupFilter
    )
  }

  const filterHouseholdsByTag = (tagId: string) => {
    setShowTagDropdown(false)
    setSelectedTagFilter(tagId)
    filterHouseholds(
      searchInput,
      selectedRsvpFilter,
      tagId,
      selectedCountryFilter,
      selectedSideFilter,
      selectedGroupFilter
    )
  }

  const filterHouseholdsByCountry = (country: string) => {
    setShowCountryDropdown(false)
    setSelectedCountryFilter(country)
    filterHouseholds(
      searchInput,
      selectedRsvpFilter,
      selectedTagFilter,
      country,
      selectedSideFilter,
      selectedGroupFilter
    )
  }

  const filterHouseholdsBySide = (sideKey: string) => {
    setShowSideDropdown(false)
    setSelectedSideFilter(sideKey)
    filterHouseholds(
      searchInput,
      selectedRsvpFilter,
      selectedTagFilter,
      selectedCountryFilter,
      sideKey,
      selectedGroupFilter
    )
  }

  const filterHouseholdsByGroup = (groupKey: string) => {
    setShowGroupDropdown(false)
    setSelectedGroupFilter(groupKey)
    filterHouseholds(
      searchInput,
      selectedRsvpFilter,
      selectedTagFilter,
      selectedCountryFilter,
      selectedSideFilter,
      groupKey
    )
  }

  const clearTagFilter = () => {
    setShowTagDropdown(false)
    setSelectedTagFilter(null)
    filterHouseholds(
      searchInput,
      selectedRsvpFilter,
      null,
      selectedCountryFilter,
      selectedSideFilter,
      selectedGroupFilter
    )
  }

  const clearGroupFilter = () => {
    setShowGroupDropdown(false)
    setSelectedGroupFilter(null)
    filterHouseholds(
      searchInput,
      selectedRsvpFilter,
      selectedTagFilter,
      selectedCountryFilter,
      selectedSideFilter,
      null
    )
  }

  const hasActiveFilters =
    !!selectedRsvpFilter ||
    !!selectedTagFilter ||
    !!selectedCountryFilter ||
    !!selectedSideFilter ||
    !!selectedGroupFilter ||
    !!searchInput

  useEffect(() => {
    onFiltersChange?.({
      search: searchInput,
      rsvp: selectedRsvpFilter,
      tagId: selectedTagFilter,
      country: selectedCountryFilter,
      side: selectedSideFilter,
      group: selectedGroupFilter,
    })
  }, [
    onFiltersChange,
    searchInput,
    selectedCountryFilter,
    selectedGroupFilter,
    selectedRsvpFilter,
    selectedSideFilter,
    selectedTagFilter,
  ])

  const clearAllFilters = () => {
    setFilteredHouseholds(households)
    setSearchInput('')
    setSelectedRsvpFilter(null)
    setSelectedTagFilter(null)
    setSelectedCountryFilter(null)
    setSelectedSideFilter(null)
    setSelectedGroupFilter(null)
  }

  useEffect(() => {
    if (!mobileFiltersOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileFiltersOpenChange?.(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileFiltersOpen, onMobileFiltersOpenChange])

  const selectedTagName = allTags.find((t) => t.id === selectedTagFilter)?.name
  const selectedSideLabel = availableSides.find((s) => s.key === selectedSideFilter)?.label
  const selectedGroupLabel = availableGroups.find((g) => g.key === selectedGroupFilter)?.label
  const selectedEventName =
    selectedRsvpFilter === null
      ? null
      : events.find((event) => event.id === selectedRsvpFilter.eventId)?.name

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
              {selectedRsvpFilter === null ? (
                <span>סטטוס RSVP</span>
              ) : (
                <div className='flex items-center gap-1.5'>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${sharedStyles.getRSVPcolor(
                      selectedRsvpFilter.rsvpValue
                    )}`}
                  />
                  <span className='truncate'>
                    {RSVP_STATUS_LABELS[selectedRsvpFilter.rsvpValue as RsvpStatus] ??
                      selectedRsvpFilter.rsvpValue}
                  </span>
                </div>
              )}
              <IoIosArrowDown size={16} />
            </Button>
            {showInvitationDropdown && (
              <div className='absolute start-0 top-full z-10 mt-1 max-h-64 w-48 overflow-auto rounded-md border bg-popover p-3 shadow-md'>
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
                            setSelectedRsvpFilter={setSelectedRsvpFilter}
                            isSelected={
                              event.id === selectedRsvpFilter?.eventId &&
                              rsvp === selectedRsvpFilter?.rsvpValue
                            }
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
                {selectedTagFilter === null ? (
                  <span>תגית אורח</span>
                ) : (
                  <span className='truncate'>{selectedTagName ?? selectedTagFilter}</span>
                )}
                <IoIosArrowDown size={16} />
              </Button>
              {showTagDropdown && (
                <div className='absolute start-0 top-full z-10 mt-1 w-64 rounded-md border bg-popover shadow-md'>
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
                      {selectedTagFilter === null ? (
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
                        {selectedTagFilter === tag.id && (
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
                {selectedSideFilter === null ? (
                  <span>צד</span>
                ) : (
                  <span className='truncate'>{selectedSideLabel ?? selectedSideFilter}</span>
                )}
                <IoIosArrowDown size={16} />
              </Button>
              {showSideDropdown && (
                <div className='absolute start-0 top-full z-10 mt-1 max-h-64 w-40 overflow-auto rounded-md border bg-popover p-1 shadow-md'>
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
                      {selectedSideFilter === side.key && (
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
                {selectedGroupFilter === null ? (
                  <span>קבוצה</span>
                ) : (
                  <span className='truncate'>{selectedGroupLabel ?? selectedGroupFilter}</span>
                )}
                <IoIosArrowDown size={16} />
              </Button>
              {showGroupDropdown && (
                <div className='absolute start-0 top-full z-10 mt-1 w-80 rounded-md border bg-popover shadow-md'>
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
                      {selectedGroupFilter === null ? (
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
                              {selectedGroupFilter === group.key ? (
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
              {selectedCountryFilter === null ? (
                <span>ארץ</span>
              ) : (
                <span className='truncate'>{selectedCountryFilter}</span>
              )}
              <IoIosArrowDown size={16} />
            </Button>
            {showCountryDropdown && (
              <div className='absolute start-0 top-full z-10 mt-1 max-h-64 w-40 overflow-auto rounded-md border bg-popover p-1 shadow-md'>
                {availableCountries.length === 0 ? (
                  <p className='px-2 py-1.5 text-muted-foreground text-sm'>לא נמצאו מדינות</p>
                ) : (
                  availableCountries.map((country) => (
                    <button
                      key={country}
                      type='button'
                      className='flex w-full cursor-pointer items-center justify-between rounded-sm p-2 text-sm transition-colors hover:bg-accent'
                      onClick={() => filterHouseholdsByCountry(country)}
                    >
                      <span>{country}</span>
                      {selectedCountryFilter === country && (
                        <IoMdCheckmark size={16} className='text-primary' />
                      )}
                    </button>
                  ))
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
      </div>

      {hasActiveFilters ? (
        <div
          data-testid='active-filter-chips'
          className='flex flex-wrap items-center justify-start gap-2'
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
          {selectedRsvpFilter ? (
            <button
              type='button'
              className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
              onClick={() => {
                setSelectedRsvpFilter(null)
                filterHouseholds(
                  searchInput,
                  null,
                  selectedTagFilter,
                  selectedCountryFilter,
                  selectedSideFilter,
                  selectedGroupFilter
                )
              }}
            >
              סטטוס RSVP:{' '}
              {RSVP_STATUS_LABELS[selectedRsvpFilter.rsvpValue as RsvpStatus] ??
                selectedRsvpFilter.rsvpValue}
              {selectedEventName ? ` (${selectedEventName})` : ''} ×
            </button>
          ) : null}
          {selectedTagFilter ? (
            <button
              type='button'
              className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
              onClick={() => {
                setSelectedTagFilter(null)
                filterHouseholds(
                  searchInput,
                  selectedRsvpFilter,
                  null,
                  selectedCountryFilter,
                  selectedSideFilter,
                  selectedGroupFilter
                )
              }}
            >
              תגית: {selectedTagName ?? selectedTagFilter} ×
            </button>
          ) : null}
          {selectedSideFilter ? (
            <button
              type='button'
              className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
              onClick={() => {
                setSelectedSideFilter(null)
                filterHouseholds(
                  searchInput,
                  selectedRsvpFilter,
                  selectedTagFilter,
                  selectedCountryFilter,
                  null,
                  selectedGroupFilter
                )
              }}
            >
              צד: {selectedSideLabel ?? selectedSideFilter} ×
            </button>
          ) : null}
          {selectedGroupFilter ? (
            <button
              type='button'
              className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
              onClick={() => {
                setSelectedGroupFilter(null)
                filterHouseholds(
                  searchInput,
                  selectedRsvpFilter,
                  selectedTagFilter,
                  selectedCountryFilter,
                  selectedSideFilter,
                  null
                )
              }}
            >
              קבוצה: {selectedGroupLabel ?? selectedGroupFilter} ×
            </button>
          ) : null}
          {selectedCountryFilter ? (
            <button
              type='button'
              className='shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
              onClick={() => {
                setSelectedCountryFilter(null)
                filterHouseholds(
                  searchInput,
                  selectedRsvpFilter,
                  selectedTagFilter,
                  null,
                  selectedSideFilter,
                  selectedGroupFilter
                )
              }}
            >
              ארץ: {selectedCountryFilter} ×
            </button>
          ) : null}
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
  )
}

type InvitationOptionProps = {
  rsvpValue: string
  eventId: string
  setSelectedRsvpFilter: Dispatch<SetStateAction<TSelectedRsvpFilter | null>>
  filterHouseholdsByInvitation: (filter: TSelectedRsvpFilter) => void
  isSelected: boolean
}

const InvitationOption = ({
  rsvpValue,
  eventId,
  setSelectedRsvpFilter,
  filterHouseholdsByInvitation,
  isSelected,
}: InvitationOptionProps) => {
  const handleChangeOption = () => {
    setSelectedRsvpFilter({ eventId, rsvpValue })
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
