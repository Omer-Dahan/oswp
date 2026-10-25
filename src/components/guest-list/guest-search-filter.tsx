import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react'
import { FaMagnifyingGlass } from 'react-icons/fa6'
import { IoIosArrowDown, IoMdCheckmark } from 'react-icons/io'
import { sharedStyles } from '~/app/utils/shared-styles'
import type { Event } from '~/app/utils/shared-types'
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

type GuestSearchFilterProps = {
  households: HouseholdWithGuests[]
  setFilteredHouseholds: Dispatch<SetStateAction<HouseholdWithGuests[]>>
  events: Event[]
  selectedEventId: string
}

export default function GuestSearchFilter({
  households,
  setFilteredHouseholds,
  events,
  selectedEventId,
}: GuestSearchFilterProps) {
  const [searchInput, setSearchInput] = useState('')
  const [showInvitationDropdown, setShowInvitationDropdown] = useState(false)
  const [selectedRsvpFilter, setSelectedRsvpFilter] = useState<TSelectedRsvpFilter | null>(null)
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null)
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string | null>(null)
  const [showSideDropdown, setShowSideDropdown] = useState(false)
  const [selectedSideFilter, setSelectedSideFilter] = useState<string | null>(null)
  const [showGroupDropdown, setShowGroupDropdown] = useState(false)
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null)

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

  // Groups households by trimmed/case-insensitive value while keeping one canonical
  // spelling (the first one seen) so stray whitespace/case differences don't split a count.
  const countByNormalizedValue = (values: Array<string | null | undefined>) => {
    const counts = new Map<string, { label: string; count: number }>()
    for (const raw of values) {
      const trimmed = raw?.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      const existing = counts.get(key)
      if (existing) {
        existing.count += 1
      } else {
        counts.set(key, { label: trimmed, count: 1 })
      }
    }
    return Array.from(counts.entries())
      .map(([key, { label, count }]) => ({ key, label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }

  const availableSides = useMemo(
    () => countByNormalizedValue(households.map((h) => h.side)),
    [households]
  )

  const availableGroups = useMemo(
    () => countByNormalizedValue(households.map((h) => h.groupName)),
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
    () => allTags.filter((tag) => (availableTagCounts.get(tag.id) ?? 0) > 0),
    [allTags, availableTagCounts]
  )

  useEffect(() => {
    void selectedEventId
    // Reset filters when event context changes so state never carries hidden stale constraints.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedRsvpFilter(null)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedTagFilter(null)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCountryFilter(null)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedSideFilter(null)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedGroupFilter(null)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilteredHouseholds(households)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchInput('')
  }, [selectedEventId, households, setFilteredHouseholds])

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

        if (sideFilter && household.side?.trim().toLowerCase() !== sideFilter) return false

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

  const hasActiveFilters =
    !!selectedRsvpFilter ||
    !!selectedTagFilter ||
    !!selectedCountryFilter ||
    !!selectedSideFilter ||
    !!selectedGroupFilter ||
    !!searchInput

  const clearAllFilters = () => {
    setFilteredHouseholds(households)
    setSearchInput('')
    setSelectedRsvpFilter(null)
    setSelectedTagFilter(null)
    setSelectedCountryFilter(null)
    setSelectedSideFilter(null)
    setSelectedGroupFilter(null)
  }

  const selectedTagName = allTags.find((t) => t.id === selectedTagFilter)?.name
  const selectedSideLabel = availableSides.find((s) => s.key === selectedSideFilter)?.label
  const selectedGroupLabel = availableGroups.find((g) => g.key === selectedGroupFilter)?.label
  const selectedEventName =
    selectedRsvpFilter === null
      ? null
      : events.find((event) => event.id === selectedRsvpFilter.eventId)?.name

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex flex-wrap items-center gap-3'>
        <div className='relative flex items-center'>
          <Input
            id='search-guests-input'
            className='w-64 pe-12 font-sans text-sm'
            placeholder='חיפוש אורחים'
            value={searchInput}
            onChange={(e) => filterHouseholdsBySearch(e.target.value)}
          />
          <div className='absolute end-0 flex h-full w-12 items-center justify-center rounded-e-md bg-primary'>
            <FaMagnifyingGlass className='text-primary-foreground' size={18} />
          </div>
        </div>

        <div ref={invitationFilterRef}>
          <div className='relative'>
            <Button
              variant='outline'
              onClick={() => setShowInvitationDropdown((prev) => !prev)}
              className='w-48 justify-between font-sans text-sm normal-case tracking-normal'
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
              <div className='absolute top-full start-0 z-10 mt-1 max-h-64 w-48 overflow-auto rounded-md border bg-popover p-3 shadow-md'>
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
          <div ref={tagFilterRef}>
            <div className='relative'>
              <Button
                variant='outline'
                onClick={() => setShowTagDropdown((prev) => !prev)}
                className='w-40 justify-between font-sans text-sm normal-case tracking-normal'
              >
                {selectedTagFilter === null ? (
                  <span>תגית אורח</span>
                ) : (
                  <span className='truncate'>{selectedTagName ?? selectedTagFilter}</span>
                )}
                <IoIosArrowDown size={16} />
              </Button>
              {showTagDropdown && (
                <div className='absolute top-full start-0 z-10 mt-1 max-h-64 w-40 overflow-auto rounded-md border bg-popover p-1 shadow-md'>
                  {availableTags.map((tag) => (
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
                </div>
              )}
            </div>
          </div>
        )}

        {availableSides.length > 0 && (
          <div ref={sideFilterRef}>
            <div className='relative'>
              <Button
                variant='outline'
                onClick={() => setShowSideDropdown((prev) => !prev)}
                className='w-40 justify-between font-sans text-sm normal-case tracking-normal'
              >
                {selectedSideFilter === null ? (
                  <span>צד</span>
                ) : (
                  <span className='truncate'>{selectedSideLabel ?? selectedSideFilter}</span>
                )}
                <IoIosArrowDown size={16} />
              </Button>
              {showSideDropdown && (
                <div className='absolute top-full start-0 z-10 mt-1 max-h-64 w-40 overflow-auto rounded-md border bg-popover p-1 shadow-md'>
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
          <div ref={groupFilterRef}>
            <div className='relative'>
              <Button
                variant='outline'
                onClick={() => setShowGroupDropdown((prev) => !prev)}
                className='w-40 justify-between font-sans text-sm normal-case tracking-normal'
              >
                {selectedGroupFilter === null ? (
                  <span>קבוצה</span>
                ) : (
                  <span className='truncate'>{selectedGroupLabel ?? selectedGroupFilter}</span>
                )}
                <IoIosArrowDown size={16} />
              </Button>
              {showGroupDropdown && (
                <div className='absolute top-full start-0 z-10 mt-1 max-h-64 w-40 overflow-auto rounded-md border bg-popover p-1 shadow-md'>
                  {availableGroups.map((group) => (
                    <button
                      key={group.key}
                      type='button'
                      className='flex w-full cursor-pointer items-center justify-between rounded-sm p-2 text-sm transition-colors hover:bg-accent'
                      onClick={() => filterHouseholdsByGroup(group.key)}
                    >
                      <span>
                        {group.label} ({group.count})
                      </span>
                      {selectedGroupFilter === group.key && (
                        <IoMdCheckmark size={16} className='text-primary' />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={countryFilterRef}>
          <div className='relative'>
            <Button
              variant='outline'
              onClick={() => setShowCountryDropdown((prev) => !prev)}
              className='w-40 justify-between font-sans text-sm normal-case tracking-normal'
            >
              {selectedCountryFilter === null ? (
                <span>ארץ</span>
              ) : (
                <span className='truncate'>{selectedCountryFilter}</span>
              )}
              <IoIosArrowDown size={16} />
            </Button>
            {showCountryDropdown && (
              <div className='absolute top-full start-0 z-10 mt-1 max-h-64 w-40 overflow-auto rounded-md border bg-popover p-1 shadow-md'>
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

        {hasActiveFilters && (
          <Button
            variant='ghost'
            size='sm'
            className='font-sans text-primary text-sm normal-case tracking-normal'
            onClick={clearAllFilters}
          >
            נקה סינון
          </Button>
        )}
      </div>

      {hasActiveFilters ? (
        <div className='flex flex-wrap items-center gap-2'>
          {searchInput ? (
            <button
              type='button'
              className='rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
              onClick={() => filterHouseholdsBySearch('')}
            >
              חיפוש: {searchInput} ×
            </button>
          ) : null}
          {selectedRsvpFilter ? (
            <button
              type='button'
              className='rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
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
              className='rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
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
              className='rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
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
              className='rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
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
              className='rounded-full border border-border bg-muted px-2.5 py-1 text-xs'
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
