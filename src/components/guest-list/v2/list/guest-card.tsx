import { memo, useCallback } from 'react'

import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'

type GuestCardProps = {
  household: HouseholdWithGuests
  onSelectHousehold: (household: HouseholdWithGuests) => void
  isSelected?: boolean
}

type RsvpSummary = {
  attending: number
  invited: number
  declined: number
}

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

const getPrimaryGuestPhone = (household: HouseholdWithGuests): string | null => {
  const primaryGuest =
    household.guests.find((guest) => guest.isPrimaryContact) ?? household.guests[0]

  return primaryGuest?.phone ?? null
}

const getRsvpSummary = (household: HouseholdWithGuests): RsvpSummary => {
  // Include all guests — tag-alongs now have invitations for events that allow them
  return household.guests.reduce<RsvpSummary>(
    (summary, guest) => {
      for (const invitation of guest.invitations) {
        if (invitation.rsvp === 'Attending') {
          summary.attending += 1
          continue
        }

        if (invitation.rsvp === 'Invited') {
          summary.invited += 1
          continue
        }

        if (invitation.rsvp === 'Declined') {
          summary.declined += 1
        }
      }

      return summary
    },
    {
      attending: 0,
      invited: 0,
      declined: 0,
    }
  )
}

/** Compact "מגיעים 4 · 2 ילדים · תזונה" summary of what the guest reported on the RSVP flow. */
const getRsvpPartyDetailsLabel = (household: HouseholdWithGuests): string | null => {
  const parts: string[] = []

  if (household.attendingCount != null) {
    parts.push(`מגיעים ${household.attendingCount}`)
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
  const primaryGuest =
    household.guests.find((guest) => guest.isPrimaryContact) ?? household.guests[0]

  if (primaryGuest === undefined) return 'משק בית ללא שם'

  return `${primaryGuest.firstName} ${primaryGuest.lastName}`
}

function GuestCardComponent({
  household,
  onSelectHousehold,
  isSelected = false,
}: Readonly<GuestCardProps>) {
  const primaryGuestName = getPrimaryGuestName(household)
  const invitedGuests = household.guests.filter((guest) => !guest.isTagAlong)
  const tagAlongCount = household.guests.length - invitedGuests.length
  const extraGuestsCount = Math.max(household.guests.length - 1, 0)
  const summaryName =
    extraGuestsCount > 0 ? `${primaryGuestName} +${extraGuestsCount}` : primaryGuestName
  const guestCount = household.invitedCount ?? invitedGuests.length

  const rsvpSummary = getRsvpSummary(household)
  const rsvpPartyDetailsLabel = getRsvpPartyDetailsLabel(household)
  const initials = getInitials(primaryGuestName)
  const phone = getPrimaryGuestPhone(household)
  const handleSelect = useCallback(() => {
    onSelectHousehold(household)
  }, [household, onSelectHousehold])

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
              {guestCount} אורחים
              {tagAlongCount > 0 && ` +${tagAlongCount}`}
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
                {rsvpSummary.attending} מגיעים
              </Badge>
            )}
            {rsvpSummary.invited > 0 && (
              <Badge
                variant='outline'
                className='border-foreground/20 bg-gold/12 font-normal text-foreground/80'
              >
                {rsvpSummary.invited} הוזמנו
              </Badge>
            )}
            {rsvpSummary.declined > 0 && (
              <Badge
                variant='outline'
                className='border-destructive/30 bg-destructive/10 font-normal text-destructive'
              >
                {rsvpSummary.declined} לא מגיעים
              </Badge>
            )}
            {rsvpSummary.attending === 0 &&
              rsvpSummary.invited === 0 &&
              rsvpSummary.declined === 0 && (
                <span className='text-muted-foreground'>אין נתוני אישור הגעה</span>
              )}
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
