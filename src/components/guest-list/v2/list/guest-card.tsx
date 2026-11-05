import { MoreVertical } from 'lucide-react'
import { memo, useCallback, useState } from 'react'

import { PartialEventAnswerLine } from '~/components/guest-list/v2/list/partial-event-answer-line'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  getHouseholdWeddingRsvpCounts,
  type RsvpEventInput,
  resolveRsvpEvents,
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
  return eventIds.size === 1 ? ([...eventIds][0] ?? null) : null
}

/** Compact "1 לפי דיווח האורח · 2 ילדים · תזונה" summary of what the guest reported on the RSVP flow. */
const getRsvpPartyDetailsLabel = (
  household: HouseholdWithGuests,
  namedAttending: number,
  weddingAnswered: boolean
): string | null => {
  const parts: string[] = []

  // Only surfaced when the reception was actually answered and it adds
  // information beyond the "X מגיעים" badge above (e.g. unnamed extra
  // guests) - otherwise either a household that hasn't answered the
  // reception, or the same headcount printed twice, reads as a mismatch
  // rather than a confirmation.
  if (
    weddingAnswered &&
    household.attendingCount != null &&
    household.attendingCount !== namedAttending
  ) {
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
  const totalInvited = rsvpSummary.attending + rsvpSummary.invited + rsvpSummary.declined
  const weddingAnswered = rsvpSummary.attending > 0 || rsvpSummary.declined > 0

  // A household that answered only the chuppah gets its own arrival state
  // instead of reading as entirely unanswered (owner decision, 05.11.2026).
  const { weddingEvent, chuppahEvent } = resolveRsvpEvents(events)
  const chuppahSummary = getHouseholdWeddingRsvpCounts(household.guests, chuppahEvent?.id ?? null)
  const isChuppahOnlyArrival =
    !weddingAnswered &&
    weddingEvent !== null &&
    chuppahEvent !== null &&
    chuppahSummary.attending > 0

  const rsvpPartyDetailsLabel = getRsvpPartyDetailsLabel(
    household,
    rsvpSummary.attending,
    weddingAnswered
  )
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
    <div className='group w-full text-start'>
      <Card
        className={`relative rounded-xl border-border transition-colors hover:bg-muted/30 ${
          isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'bg-card/90'
        }`}
      >
        <button
          type='button'
          className='absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          aria-label={`בחירת משק הבית של ${primaryGuestName}`}
          onClick={handleSelect}
        />
        <CardContent className='pointer-events-none relative z-10 grid grid-cols-[1fr_auto] items-start gap-x-[14px] gap-y-1 p-[15px_16px]'>
          <div className='min-w-0'>
            <div className='flex min-w-0 items-center gap-2'>
              <span className='flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[11px] text-muted-foreground'>
                {initials}
              </span>
              <span className='truncate font-hebrew text-[16.5px] font-medium leading-[1.2] text-foreground'>
                {primaryGuestName}
              </span>
            </div>
            {metaLine && (
              <p className='mt-[5px] truncate text-[12.5px] text-muted-foreground'>{metaLine}</p>
            )}
          </div>

          <div className='pt-0.5 text-left leading-[1.05]'>
            {weddingAnswered && rsvpSummary.attending > 0 ? (
              <>
                <div className='text-[22px] font-semibold text-success tabular-nums'>
                  {rsvpSummary.attending}
                  <small className='mt-0.5 block text-[12px] font-normal text-success/80'>
                    {rsvpSummary.attending === 1 ? 'מגיע' : 'מגיעים'}
                  </small>
                </div>
                <div className='mt-1.5 whitespace-nowrap text-[12.5px] text-muted-foreground'>
                  מתוך {totalInvited} {totalInvited === 1 ? 'שהוזמן' : 'שהוזמנו'}
                </div>
              </>
            ) : isChuppahOnlyArrival ? (
              <>
                <div className='text-[22px] font-semibold text-success tabular-nums'>
                  {chuppahSummary.attending}
                  <small className='mt-0.5 block text-[12px] font-normal text-success/80'>
                    {chuppahSummary.attending === 1 ? 'מגיע לחופה' : 'מגיעים לחופה'}
                  </small>
                </div>
                <div className='mt-1.5 whitespace-nowrap text-[12.5px] text-muted-foreground'>
                  {weddingEvent?.name} טרם השיבה
                </div>
              </>
            ) : weddingAnswered ? (
              <>
                <div className='pt-1 text-[19px] font-semibold text-destructive'>לא מגיעים</div>
                <div className='mt-1.5 whitespace-nowrap text-[12.5px] text-muted-foreground'>
                  מתוך {totalInvited} {totalInvited === 1 ? 'שהוזמן' : 'שהוזמנו'}
                </div>
              </>
            ) : (
              <>
                <div className='pt-1.5 text-[16px] font-medium text-muted-foreground'>
                  טרם השיבו
                </div>
                {rsvpSummary.invited > 0 && (
                  <div className='mt-1.5 whitespace-nowrap text-[12.5px] text-muted-foreground'>
                    {rsvpSummary.invited} {rsvpSummary.invited === 1 ? 'הוזמן' : 'הוזמנו'}
                  </div>
                )}
              </>
            )}
          </div>

          {!isChuppahOnlyArrival && (
            <PartialEventAnswerLine
              guests={household.guests}
              events={events}
              className='col-span-2 text-[12.5px] text-destructive'
            />
          )}

          {rsvpPartyDetailsLabel && (
            <Badge
              variant='outline'
              className='col-span-2 w-fit border-foreground/15 bg-foreground/[0.04] font-normal text-foreground/70'
            >
              {rsvpPartyDetailsLabel}
            </Badge>
          )}
        </CardContent>
        <div className='absolute bottom-2 start-2 z-20 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type='button'
                aria-label={`פעולות עבור ${primaryGuestName}`}
                className='flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              >
                <MoreVertical className='h-4 w-4' aria-hidden='true' />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align='start'
              className='font-hebrew'
              onClick={(event) => event.stopPropagation()}
            >
              <DropdownMenuItem onSelect={() => void handleCopyInviteLink()} className='min-h-11'>
                {copiedInviteLink ? 'ההודעה הועתקה' : 'העתקת הודעת הזמנה'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleSelect} className='min-h-11'>
                צפייה בפרטים
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    </div>
  )
}

export const GuestCard = memo(GuestCardComponent)
