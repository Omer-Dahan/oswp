import { memo, useCallback, useState } from 'react'

import { PartialEventAnswerLine } from '~/components/guest-list/v2/list/partial-event-answer-line'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
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

/** Compact "2 ילדים · תזונה" summary of what the guest reported on the RSVP flow. */
const getRsvpPartyDetailsLabel = (household: HouseholdWithGuests): string | null => {
  const parts: string[] = []

  if (household.childrenCount != null && household.childrenCount > 0) {
    parts.push(`${household.childrenCount} ילדים`)
  }
  if (household.dietaryNotes) {
    parts.push('תזונה')
  }

  return parts.length > 0 ? parts.join(' · ') : null
}

/** "צד כלה · קבוצה חברים" meta line under the name - only the parts that exist. */
const getHouseholdMetaLine = (household: HouseholdWithGuests): string | null => {
  const parts: string[] = []
  if (household.side) parts.push(`צד ${household.side}`)
  if (household.groupName) parts.push(`קבוצה ${household.groupName}`)
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
  const metaLine = getHouseholdMetaLine(household)

  const weddingEventId = resolveHouseholdWeddingEventId(household, events)
  const rsvpSummary = getHouseholdWeddingRsvpCounts(household.guests, weddingEventId)
  // A stored household count is the guest's own report and always wins over
  // the count of named guests with an Attending row, including an explicit
  // 0 - a null count falls back to the named rows. Either one being present
  // means the wedding has been answered, even when the stored count is 0.
  const storedCount = household.attendingCount
  const hasStoredCount = storedCount != null
  const arrivingCount = hasStoredCount ? storedCount : rsvpSummary.attending
  const weddingAnswered = hasStoredCount || rsvpSummary.attending > 0 || rsvpSummary.declined > 0

  // A household that answered only the chuppah gets its own arrival state
  // instead of reading as entirely unanswered (owner decision, 05.11.2026).
  const { weddingEvent, chuppahEvent } = resolveRsvpEvents(events)
  const chuppahSummary = getHouseholdWeddingRsvpCounts(household.guests, chuppahEvent?.id ?? null)
  const isChuppahOnlyArrival =
    !weddingAnswered && weddingEvent !== null && chuppahEvent !== null && chuppahSummary.attending > 0

  const rsvpPartyDetailsLabel = getRsvpPartyDetailsLabel(household)
  const initials = getInitials(primaryGuestName)
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
        className={`rounded-[14px] border-[#e7e1d5] transition-colors hover:bg-muted/30 ${
          isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'bg-card/90'
        }`}
      >
        <CardContent className='grid grid-cols-[1fr_auto] items-start gap-x-[14px] gap-y-1 p-[15px_16px]'>
          <div className='min-w-0'>
            <div className='flex min-w-0 items-center gap-2'>
              <span className='flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-[#e2dacb] bg-[#f1ece1] text-[11px] text-[#6d6353]'>
                {initials}
              </span>
              <span className='truncate font-hebrew text-[16.5px] font-medium leading-[1.2] text-foreground'>
                {primaryGuestName}
              </span>
            </div>
            {metaLine && (
              <p className='mt-[5px] truncate text-[12.5px] text-[#8a7f6d]'>{metaLine}</p>
            )}
          </div>

          <div className='pt-0.5 text-left leading-[1.05]'>
            {weddingAnswered && arrivingCount > 0 ? (
              <div className='text-[22px] font-semibold text-[#2f5137] [font-variant-numeric:tabular-nums]'>
                {arrivingCount}
                <small className='mt-0.5 block text-[12px] font-normal text-[#6f8b74]'>
                  {arrivingCount === 1 ? 'מגיע לחתונה' : 'מגיעים לחתונה'}
                </small>
              </div>
            ) : isChuppahOnlyArrival ? (
              <>
                <div className='text-[22px] font-semibold text-[#2f5137] [font-variant-numeric:tabular-nums]'>
                  {chuppahSummary.attending}
                  <small className='mt-0.5 block text-[12px] font-normal text-[#6f8b74]'>
                    {chuppahSummary.attending === 1 ? 'מגיע לחופה' : 'מגיעים לחופה'}
                  </small>
                </div>
                <div className='mt-1.5 whitespace-nowrap text-[12.5px] text-[#9a8f7c]'>
                  {weddingEvent?.name} טרם השיבה
                </div>
              </>
            ) : weddingAnswered ? (
              <div className='pt-1 text-[15px] font-semibold text-[#a4553f]'>לא מגיעים לחתונה</div>
            ) : (
              <>
                <div className='pt-1.5 text-[16px] font-medium text-[#a2937c]'>טרם השיבו</div>
                {rsvpSummary.attending + rsvpSummary.invited + rsvpSummary.declined === 0 && (
                  <div className='mt-1.5 whitespace-nowrap text-[12.5px] text-[#9a8f7c]'>לא הוזמן</div>
                )}
              </>
            )}
          </div>

          {!isChuppahOnlyArrival && (
            <PartialEventAnswerLine
              guests={household.guests}
              events={events}
              className='col-span-2 text-[12.5px] text-[#a4553f]'
            />
          )}

          <div className='col-span-2 flex justify-end text-xs'>
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
              className='inline-flex cursor-pointer items-center gap-1 rounded-full border border-border/70 bg-transparent px-2.5 py-1 text-xs text-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]'
            >
              {copiedInviteLink ? 'הועתק' : 'העתקת הודעה'}
            </span>
          </div>

          {rsvpPartyDetailsLabel && (
            <Badge
              variant='outline'
              className='col-span-2 w-fit border-foreground/15 bg-foreground/[0.04] font-normal text-foreground/70'
            >
              {rsvpPartyDetailsLabel}
            </Badge>
          )}

          <div className='col-span-2 flex items-center justify-end border-border/80 border-t pt-2'>
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
