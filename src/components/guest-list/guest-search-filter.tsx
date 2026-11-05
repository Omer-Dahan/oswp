import { Filter, Search, X } from 'lucide-react'
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { Event } from '~/app/utils/shared-types'
import type { GuestListFilters } from '~/components/guest-list/guest-list-view-state'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { RSVP_STATUS_LABELS, type RsvpStatus } from '~/lib/constants/rsvp'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'
import { api } from '~/trpc/react'

const NO_SIDE_FILTER_KEY = '__no_side__'

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
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

type GuestSearchFilterProps = {
  households: HouseholdWithGuests[]
  setFilteredHouseholds: Dispatch<SetStateAction<HouseholdWithGuests[]>>
  events: Event[]
  selectedEventId: string
  initialFilters?: GuestListFilters
  resetKey?: number
  onFiltersChange?: (filters: GuestListFilters) => void
}

export default function GuestSearchFilter({
  households,
  setFilteredHouseholds,
  events,
  selectedEventId,
  initialFilters,
  resetKey = 0,
  onFiltersChange,
}: GuestSearchFilterProps) {
  const [filters, setFilters] = useState<GuestListFilters>(
    initialFilters ?? {
      search: '',
      rsvp: null,
      tagId: null,
      country: null,
      side: null,
      group: null,
    }
  )
  const { data: allTags = [] } = api.guestTag.getAll.useQuery()

  const countries = useMemo(
    () => Array.from(new Set(households.map((h) => h.country).filter(Boolean) as string[])).sort(),
    [households]
  )
  const sides = useMemo(() => {
    const values = countByNormalizedValue(households.map((h) => h.side))
    const missing = households.filter((h) => !h.side?.trim()).length
    if (missing > 0) values.push({ key: NO_SIDE_FILTER_KEY, label: 'ללא צד', count: missing })
    return values
  }, [households])
  const groups = useMemo(
    () => countByNormalizedValue(households.map((h) => h.groupName)),
    [households]
  )
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const household of households) {
      const ids = new Set(household.guests.flatMap((g) => g.guestTags?.map((t) => t.tagId) ?? []))
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }, [households])
  const tags = useMemo(
    () => allTags.filter((tag) => (tagCounts.get(tag.id) ?? 0) > 0),
    [allTags, tagCounts]
  )

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    return households.filter((household) => {
      if (filters.country && household.country !== filters.country) return false
      if (filters.side === NO_SIDE_FILTER_KEY && household.side?.trim()) return false
      if (
        filters.side &&
        filters.side !== NO_SIDE_FILTER_KEY &&
        household.side?.trim().toLowerCase() !== filters.side
      )
        return false
      if (filters.group && household.groupName?.trim().toLowerCase() !== filters.group) return false
      if (
        filters.tagId &&
        !household.guests.some((g) => g.guestTags?.some((tag) => tag.tagId === filters.tagId))
      )
        return false

      return household.guests.some((guest) => {
        const name = `${guest.firstName} ${guest.lastName}`.toLowerCase()
        if (search && !name.includes(search)) return false
        if (!filters.rsvp) return true
        return guest.invitations.some(
          (invitation) =>
            invitation.eventId === filters.rsvp?.eventId &&
            invitation.rsvp === filters.rsvp.rsvpValue
        )
      })
    })
  }, [filters, households])

  useEffect(() => {
    setFilteredHouseholds(filtered)
    onFiltersChange?.(filters)
  }, [filtered, filters, onFiltersChange, setFilteredHouseholds])

  // biome-ignore lint/correctness/useExhaustiveDependencies: restore only when the event, data source, or explicit reset changes
  useEffect(() => {
    const stored = initialFilters ?? {
      search: '',
      rsvp: null,
      tagId: null,
      country: null,
      side: null,
      group: null,
    }
    const next: GuestListFilters = {
      search: stored.search,
      rsvp:
        stored.rsvp && events.some((event) => event.id === stored.rsvp?.eventId)
          ? stored.rsvp
          : null,
      tagId: stored.tagId && tags.some((tag) => tag.id === stored.tagId) ? stored.tagId : null,
      country: stored.country && countries.includes(stored.country) ? stored.country : null,
      side: stored.side && sides.some((side) => side.key === stored.side) ? stored.side : null,
      group:
        stored.group && groups.some((group) => group.key === stored.group) ? stored.group : null,
    }
    setFilters(next)
    // Restore only when the event, source data or explicit reset changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, households, resetKey])

  const update = <K extends keyof GuestListFilters>(key: K, value: GuestListFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }))
  const clearAll = () =>
    setFilters({ search: '', rsvp: null, tagId: null, country: null, side: null, group: null })
  const activeCount = [
    filters.rsvp,
    filters.tagId,
    filters.country,
    filters.side,
    filters.group,
  ].filter(Boolean).length
  const hasActiveFilters = activeCount > 0 || filters.search.length > 0
  const eventOptions =
    selectedEventId === 'all' ? events : events.filter((event) => event.id === selectedEventId)
  const rsvpValue = filters.rsvp ? `${filters.rsvp.eventId}|${filters.rsvp.rsvpValue}` : ''
  const chips = [
    filters.rsvp && {
      key: 'rsvp' as const,
      label: `RSVP: ${RSVP_STATUS_LABELS[filters.rsvp.rsvpValue as RsvpStatus] ?? filters.rsvp.rsvpValue}`,
    },
    filters.tagId && {
      key: 'tagId' as const,
      label: `תגית: ${allTags.find((tag) => tag.id === filters.tagId)?.name ?? ''}`,
    },
    filters.side && {
      key: 'side' as const,
      label: `צד: ${sides.find((side) => side.key === filters.side)?.label ?? ''}`,
    },
    filters.group && {
      key: 'group' as const,
      label: `קבוצה: ${groups.find((group) => group.key === filters.group)?.label ?? ''}`,
    },
    filters.country && { key: 'country' as const, label: `ארץ: ${filters.country}` },
  ].filter(Boolean) as Array<{
    key: 'rsvp' | 'tagId' | 'side' | 'group' | 'country'
    label: string
  }>

  return (
    <div className='flex min-w-0 flex-1 flex-col gap-3'>
      <div className='flex items-center gap-2'>
        <Dialog>
          <DialogTrigger asChild>
            <Button type='button' variant='outline' className='min-h-11 gap-2 font-hebrew'>
              <Filter className='h-4 w-4' aria-hidden='true' />
              סינון
              {activeCount > 0 ? (
                <span className='flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-primary-foreground text-xs tabular-nums'>
                  {activeCount}
                </span>
              ) : null}
            </Button>
          </DialogTrigger>
          <DialogContent className='top-auto bottom-0 max-h-[88dvh] w-full max-w-none translate-y-0 rounded-b-none rounded-t-xl p-0 sm:top-1/2 sm:bottom-auto sm:max-w-2xl sm:-translate-y-1/2 sm:rounded-xl'>
            <DialogHeader className='border-b px-5 py-4 text-start'>
              <DialogTitle className='font-hebrew text-xl'>סינון רשימת האורחים</DialogTitle>
              <DialogDescription className='font-hebrew'>
                בחרו מאפיינים כדי לצמצם את הרשימה.
              </DialogDescription>
            </DialogHeader>
            <div className='grid max-h-[65dvh] gap-5 overflow-y-auto px-5 py-5 sm:grid-cols-2'>
              <div className='space-y-2 sm:col-span-2'>
                <Label htmlFor='guest-search' className='font-hebrew'>
                  חיפוש לפי שם
                </Label>
                <div className='relative'>
                  <Search
                    className='absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground'
                    aria-hidden='true'
                  />
                  <Input
                    id='guest-search'
                    value={filters.search}
                    onChange={(event) => update('search', event.target.value)}
                    className='min-h-11 ps-10 font-hebrew'
                  />
                </div>
              </div>
              <FilterSelect
                id='rsvp-filter'
                label='סטטוס RSVP'
                value={rsvpValue}
                onChange={(value) => {
                  const [eventId, rsvpValue] = value.split('|')
                  update('rsvp', eventId && rsvpValue ? { eventId, rsvpValue } : null)
                }}
              >
                <option value=''>כל הסטטוסים</option>
                {eventOptions.flatMap((event) =>
                  Object.entries(RSVP_STATUS_LABELS).map(([value, label]) => (
                    <option key={`${event.id}-${value}`} value={`${event.id}|${value}`}>
                      {event.name}: {label}
                    </option>
                  ))
                )}
              </FilterSelect>
              <FilterSelect
                id='tag-filter'
                label='תגית אורח'
                value={filters.tagId ?? ''}
                onChange={(value) => update('tagId', value || null)}
              >
                <option value=''>כל התגיות</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name} ({tagCounts.get(tag.id)})
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                id='side-filter'
                label='צד'
                value={filters.side ?? ''}
                onChange={(value) => update('side', value || null)}
              >
                <option value=''>כל הצדדים</option>
                {sides.map((side) => (
                  <option key={side.key} value={side.key}>
                    {side.label} (סה״כ {side.count} {side.count === 1 ? 'משק בית' : 'משקי בית'})
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                id='group-filter'
                label='קבוצה'
                value={filters.group ?? ''}
                onChange={(value) => update('group', value || null)}
              >
                <option value=''>כל הקבוצות</option>
                {groups.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.label} (סה״כ {group.count} {group.count === 1 ? 'משק בית' : 'משקי בית'})
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                id='country-filter'
                label='ארץ'
                value={filters.country ?? ''}
                onChange={(value) => update('country', value || null)}
              >
                <option value=''>כל הארצות</option>
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </FilterSelect>
            </div>
            <div className='flex items-center justify-between border-t px-5 py-4'>
              <p className='font-hebrew text-muted-foreground text-sm' aria-live='polite'>
                מציג {filtered.length} מתוך {households.length} משקי בית
              </p>
              {hasActiveFilters ? (
                <Button
                  type='button'
                  variant='ghost'
                  onClick={clearAll}
                  className='min-h-11 font-hebrew'
                >
                  איפוס
                </Button>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
        <p className='font-hebrew text-muted-foreground text-sm' aria-live='polite'>
          מציג {filtered.length} מתוך {households.length} משקי בית
        </p>
      </div>
      {chips.length > 0 ? (
        <ul className='flex list-none flex-wrap gap-2 p-0' aria-label='סינונים פעילים'>
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type='button'
                onClick={() => update(chip.key, null)}
                aria-label={`הסרת הסינון ${chip.label}`}
                className='inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-card px-3 font-hebrew text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              >
                {chip.label}
                <X className='h-3.5 w-3.5' aria-hidden='true' />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <div className='space-y-2'>
      <Label htmlFor={id} className='font-hebrew'>
        {label}
      </Label>
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className='min-h-11 w-full rounded-md border border-input bg-background px-3 font-hebrew text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      >
        {children}
      </select>
    </div>
  )
}
