import { memo, useCallback, useState } from 'react'

import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
import { getHouseholdPartySize } from '~/lib/household-party-size'
import {
  getHouseholdWeddingRsvpCounts,
  resolveRsvpEvents,
  type RsvpEventInput,
} from '~/lib/wedding/rsvp-events'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'
import { api } from '~/trpc/react'

type GuestCardProps = {
  household: HouseholdWithGuests
  onSelectHousehold: (household: HouseholdWithGuests) => void
  isSelected?: boolean
  /** The wedding's events, used to tell the wedding apart from the chuppah. */
  events?: RsvpEventInput[]
}

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

const getPrimaryGuest = (household: HouseholdWithGuests) =>
  household.guests.find((guest) => guest.isPrimaryContact) ?? household.guests[0]

const getPrimaryGuestPhone = (household: HouseholdWithGuests): string | null => {
  return getPrimaryGuest(household)?.phone ?? null
}

/**
 * The wedding event's id, used to scope the RSVP summary to the wedding -
 * the chuppah must never add to these counts. When no `events` list is
 * given (callers that don't yet thread it through), falls back to the one
 * event id actually referenced by this household's invitations; if more
 * than one is referenced without `events` to tell them apart, the wedding
 * can't be resolved and counting is skipped rather than guessed at.
 */
const resolveHouseholdWeddingEventId = (
  household: HouseholdWithGuests,
  events: RsvpEventInput[]
): string | null => {
  if (events.length > 0) {
    return resolveRsvpEvents(events).weddingEvent?.id ?? null
  }

  const eventIds = new Set(
    household.guests.flatMap((guest) => guest.invitations.map((invitation) => invitation.eventId))
  )
  return eventIds.size === 1 ? [...eventIds][0] ?? null : null
}

/** Compact "1 לפי דיווח האורח · 2 ילדים · תזונה" summary of what the guest reported on the RSVP flow. */
const getRsvpPartyDetailsLabel = (household: HouseholdWithGuests, namedAttending: number): string | null => {
  const parts: string[] = []

  // Only surfaced when it adds information beyond the "X מגיעים" badge above
  // (e.g. unnamed extra guests) - otherwise the same headcount printed twice
  // reads as a mismatch rather than a confirmation.
  if (household.attendingCount != null && household.attendingCount !== namedAttending) {
    parts.push(`${household.attendingCount} לפי דיווח האורח`)
  }
  if (household.childrenCount != null && household.childrenCount > 0) {
    parts.push(`${household.childrenCount} ילדים`)
  }
  if (household.dietaryNotes) {
    parts.push('תזונה')
  }

  return parts.length > 0 ? parts.join(' · ') : null
}

const getPrimaryGuestName = (household: HouseholdWithGuests): string => {
  const primaryGuest = getPrimaryGuest(household)

  if (primaryGuest === undefined) return 'משק בית ללא שם'

  return `${primaryGuest.firstName} ${primaryGuest.lastName}`
}

const copyToClipboard = async (value: string): Promise<boolean> => {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Fall through to the legacy selection path below.
    }
  }

  const textArea = document.createElement('textarea')
  textArea.value = value
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  document.body.removeChild(textArea)
  return copied
}

function GuestCardComponent({
  household,
  onSelectHousehold,
  isSelected = false,
  events = [],
}: Readonly<GuestCardProps>) {
  const primaryGuestName = getPrimaryGuestName(household)
  const extraGuestsCount = Math.max(household.guests.length - 1, 0)
  const summaryName =
    extraGuestsCount > 0 ? `${primaryGuestName} +${extraGuestsCount}` : primaryGuestName
  const guestCount = getHouseholdPartySize(household)
  const guestCountLabel =
    household.attendingCount != null
      ? `${household.attendingCount} מגיעים בפועל`
      : household.invitedCount != null
        ? `${household.invitedCount} מוזמנים`
        : `${guestCount ?? 0} ${(guestCount ?? 0) === 1 ? 'רשום' : 'רשומים'}`

  const weddingEventId = resolveHouseholdWeddingEventId(household, events)
  const rsvpSummary = getHouseholdWeddingRsvpCounts(household.guests, weddingEventId)
  const rsvpPartyDetailsLabel = getRsvpPartyDetailsLabel(household, rsvpSummary.attending)
  const initials = getInitials(primaryGuestName)
  const phone = getPrimaryGuestPhone(household)
  const handleSelect = useCallback(() => {
    onSelectHousehold(household)
  }, [household, onSelectHousehold])

  const [copiedInviteLink, setCopiedInviteLink] = useState(false)
  const utils = api.useUtils()
  const handleCopyInviteLink = useCallback(async () => {
    try {
      const { message } = await utils.sms.getInviteMessage.fetch({ householdId: household.id })
      await copyToClipboard(message)
      setCopiedInviteLink(true)
      window.setTimeout(() => setCopiedInviteLink(false), 2000)
    } catch {
      setCopiedInviteLink(false)
    }
  }, [utils, household.id])

  return (
    <button
      type='button'
      className='w-full text-start'
      aria-label={`בחירת משק הבית של ${primaryGuestName}`}
      onClick={handleSelect}
    >
      <Card
        className={`transition-colors hover:bg-muted/30 ${
          isSelected
            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
            : 'border-border bg-card/90'
        }`}
      >
        <CardContent className='flex flex-col gap-3 p-4'>
          <div className='flex items-start justify-between gap-3'>
            <div className='flex min-w-0 items-start gap-2.5'>
              <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-muted/60 font-mono text-[0.58rem] text-foreground/75 uppercase tracking-wider'>
                {initials}
              </span>
              <div className='min-w-0'>
                <p className='truncate font-serif text-[1.02rem] text-foreground leading-tight'>
                  {summaryName}
                </p>
              </div>
            </div>
            <Badge
              variant='secondary'
              className='shrink-0 font-mono text-[0.54rem] uppercase tracking-wider'
            >
              {guestCountLabel}
            </Badge>
          </div>

          {(phone || household.side || household.groupName) && (
            <div className='flex flex-wrap gap-3 font-mono text-[0.58rem] text-foreground/60 uppercase tracking-wider'>
              {phone && (
                <span>
                  טלפון <span dir='ltr'>{phone}</span>
                </span>
              )}
              {household.side && <span>צד {household.side}</span>}
              {household.groupName && <span>קבוצה {household.groupName}</span>}
            </div>
          )}

          <div className='flex flex-wrap gap-2 text-xs'>
            {rsvpSummary.attending > 0 && (
              <Badge
                variant='outline'
                className='border-success/35 bg-success/12 font-normal text-success'
              >
                {rsvpSummary.attending === 1 ? 'מגיעים' : `${rsvpSummary.attending} מגיעים`}
              </Badge>
            )}
            {rsvpSummary.invited > 0 && (
              <Badge
                variant='outline'
                className='border-foreground/20 bg-gold/12 font-normal text-foreground/80'
              >
                {rsvpSummary.invited === 1 ? 'טרם השיבו' : `${rsvpSummary.invited} טרם השיבו`}
              </Badge>
            )}
            {rsvpSummary.declined > 0 && (
              <Badge
                variant='outline'
                className='border-destructive/30 bg-destructive/10 font-normal text-destructive'
              >
                {rsvpSummary.declined === 1 ? 'לא מגיעים' : `${rsvpSummary.declined} לא מגיעים`}
              </Badge>
            )}
            {rsvpSummary.attending === 0 &&
              rsvpSummary.invited === 0 &&
              rsvpSummary.declined === 0 && (
                <span className='text-muted-foreground'>אין נתוני אישור הגעה</span>
              )}
            <span
              role='button'
              tabIndex={0}
              aria-label='העתקת הודעת הזמנה אישית למשק הבית'
              onClick={(event) => {
                event.stopPropagation()
                void handleCopyInviteLink()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  void handleCopyInviteLink()
                }
              }}
              className='ms-auto inline-flex cursor-pointer items-center gap-1 rounded-full border border-border/70 bg-transparent px-2.5 py-1 text-xs text-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]'
            >
              {copiedInviteLink ? 'הועתק' : 'העתקת הודעה'}
            </span>
          </div>

          {rsvpPartyDetailsLabel && (
            <Badge
              variant='outline'
              className='w-fit border-foreground/15 bg-foreground/[0.04] font-normal text-foreground/70'
            >
              {rsvpPartyDetailsLabel}
            </Badge>
          )}

          <div className='flex items-center justify-end border-border/80 border-t pt-2'>
            <span className='font-mono text-[0.56rem] text-foreground/55 uppercase tracking-wider'>
              צפייה בפרטים →
            </span>
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

export const GuestCard = memo(GuestCardComponent)
