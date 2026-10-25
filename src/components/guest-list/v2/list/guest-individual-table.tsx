'use client'

import { memo, useCallback } from 'react'
import { Badge } from '~/components/ui/badge'
import { RSVP_STATUS_LABELS } from '~/lib/constants/rsvp'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'

type GuestIndividualTableProps = {
  households: HouseholdWithGuests[]
  householdNumberMap: Map<string, number>
  onSelectHousehold: (household: HouseholdWithGuests) => void
  selectedHouseholdId?: string
}

const thClass =
  'px-4 py-3 text-start font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'

export const GuestIndividualTable = memo(function GuestIndividualTable({
  households,
  householdNumberMap,
  onSelectHousehold,
  selectedHouseholdId,
}: Readonly<GuestIndividualTableProps>) {
  return (
    <div className='overflow-x-auto rounded-md border border-border'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='border-border border-b bg-muted/40'>
            <th className={thClass}>אדם</th>
            <th className={thClass}>משק בית</th>
            <th className={thClass}>דוא״ל</th>
            <th className={thClass}>טלפון</th>
            <th className={thClass}>צד</th>
            <th className={thClass}>קבוצה</th>
            <th className={thClass}>מספר אורחים</th>
            <th className={thClass}>אישור הגעה</th>
            <th className={thClass}>פרטי קשר מלאים</th>
          </tr>
        </thead>
        <tbody>
          {households.flatMap((household) =>
            household.guests.map((guest) => (
              <GuestTableRow
                key={guest.id}
                guest={guest}
                household={household}
                householdNumber={householdNumberMap.get(household.id) ?? 0}
                isSelected={selectedHouseholdId === household.id}
                onSelectHousehold={onSelectHousehold}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  )
})

type GuestTableRowProps = {
  guest: HouseholdWithGuests['guests'][number]
  household: HouseholdWithGuests
  householdNumber: number
  isSelected: boolean
  onSelectHousehold: (household: HouseholdWithGuests) => void
}

const GuestTableRow = memo(function GuestTableRow({
  guest,
  household,
  householdNumber,
  isSelected,
  onSelectHousehold,
}: Readonly<GuestTableRowProps>) {
  const handleClick = useCallback(() => {
    onSelectHousehold(household)
  }, [household, onSelectHousehold])

  const guestName = `${guest.firstName} ${guest.lastName}`.trim()
  const contactComplete = Boolean(guest.email && guest.phone)
  const invitedGuestCount =
    household.invitedCount ?? household.guests.filter((g) => !g.isTagAlong).length
  const rsvpSummary = guest.invitations.some((invitation) => invitation.rsvp === 'Attending')
    ? 'Attending'
    : guest.invitations.some((invitation) => invitation.rsvp === 'Declined')
      ? 'Declined'
      : guest.invitations.some((invitation) => invitation.rsvp === 'Invited')
        ? 'Invited'
        : 'Not Invited'

  return (
    <tr
      onClick={handleClick}
      className={`cursor-pointer border-border border-b transition-colors last:border-0 hover:bg-muted/30 ${
        isSelected ? 'bg-primary/5' : ''
      }`}
    >
      <td className='px-4 py-3 font-medium text-foreground'>{guestName}</td>
      <td className='px-4 py-3'>
        <span className='font-mono text-foreground/60 text-xs'>#{householdNumber}</span>
      </td>
      <td className='px-4 py-3 text-foreground/70'>
        {guest.email ?? <span className='text-foreground/35'>—</span>}
      </td>
      <td className='px-4 py-3 text-foreground/70'>
        {guest.phone ? <span dir='ltr'>{guest.phone}</span> : <span className='text-foreground/35'>—</span>}
      </td>
      <td className='px-4 py-3 text-foreground/70'>
        {household.side ?? <span className='text-foreground/35'>—</span>}
      </td>
      <td className='px-4 py-3 text-foreground/70'>
        {household.groupName ?? <span className='text-foreground/35'>—</span>}
      </td>
      <td className='px-4 py-3 text-foreground/70'>{invitedGuestCount}</td>
      <td className='px-4 py-3'>
        <Badge variant='outline'>{RSVP_STATUS_LABELS[rsvpSummary]}</Badge>
      </td>
      <td className='px-4 py-3'>
        <span
          className={contactComplete ? 'font-medium text-success' : 'font-medium text-destructive'}
        >
          {contactComplete ? 'מלא' : 'חסר'}
        </span>
      </td>
    </tr>
  )
})
