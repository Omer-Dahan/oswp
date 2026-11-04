'use client'

import { memo, useCallback, useState } from 'react'
import { InvitedAttendingLine } from '~/components/guest-list/v2/list/invited-attending-line'
import { PartialEventAnswerLine } from '~/components/guest-list/v2/list/partial-event-answer-line'
import { Badge } from '~/components/ui/badge'
import type { RsvpEventInput } from '~/lib/wedding/rsvp-events'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'
import { api } from '~/trpc/react'

type GuestIndividualTableProps = {
  households: HouseholdWithGuests[]
  householdNumberMap: Map<string, number>
  onSelectHousehold: (household: HouseholdWithGuests) => void
  selectedHouseholdId?: string
  /** The wedding's events, used to tell the wedding apart from the chuppah. */
  events?: RsvpEventInput[]
}

const thClass =
  'px-4 py-3 text-start font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'

export const GuestIndividualTable = memo(function GuestIndividualTable({
  households,
  householdNumberMap,
  onSelectHousehold,
  selectedHouseholdId,
  events = [],
}: Readonly<GuestIndividualTableProps>) {
  return (
    <div className='overflow-x-auto rounded-md border border-border'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='border-border border-b bg-muted/40'>
            <th className={thClass}>שם האורח</th>
            <th className={thClass}>טלפון</th>
            <th className={thClass}>צד</th>
            <th className={thClass}>קבוצה</th>
            <th className={thClass}>סטטוס</th>
            <th className={thClass}>קישור הזמנה</th>
          </tr>
        </thead>
        <tbody>
          {households.length === 0 ? (
            <tr>
              <td colSpan={6} className='px-4 py-12 text-center font-mono text-foreground/55'>
                לא נמצאו אורחים
              </td>
            </tr>
          ) : (
            households.map((household) => (
              <GuestTableRow
                key={household.id}
                household={household}
                householdNumber={householdNumberMap.get(household.id) ?? 0}
                isSelected={selectedHouseholdId === household.id}
                onSelectHousehold={onSelectHousehold}
                events={events}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  )
})

type GuestTableRowProps = {
  household: HouseholdWithGuests
  householdNumber: number
  isSelected: boolean
  onSelectHousehold: (household: HouseholdWithGuests) => void
  events: RsvpEventInput[]
}

const GuestTableRow = memo(function GuestTableRow({
  household,
  householdNumber,
  isSelected,
  onSelectHousehold,
  events,
}: Readonly<GuestTableRowProps>) {
  const handleClick = useCallback(() => {
    onSelectHousehold(household)
  }, [household, onSelectHousehold])

  const primaryGuest =
    household.guests.find((guest) => guest.isPrimaryContact) ?? household.guests[0]
  const guestName = primaryGuest
    ? `${primaryGuest.firstName} ${primaryGuest.lastName}`.trim()
    : 'משק בית ללא שם'
  const responses = household.guests.flatMap((guest) => guest.invitations)
  const status = responses.some((invitation) => invitation.rsvp === 'Attending')
    ? 'אישר'
    : responses.some((invitation) => invitation.rsvp === 'Declined')
      ? 'סירב'
      : 'לא השיב'
  const [copied, setCopied] = useState(false)
  const utils = api.useUtils()
  const handleCopyInvite = useCallback(async () => {
    const { message } = await utils.sms.getInviteMessage.fetch({ householdId: household.id })
    await navigator.clipboard.writeText(message)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }, [household.id, utils])

  return (
    <tr
      onClick={handleClick}
      className={`cursor-pointer border-border border-b transition-colors last:border-0 hover:bg-muted/30 ${
        isSelected ? 'bg-primary/5' : ''
      }`}
    >
      <td className='px-4 py-3 font-medium text-foreground' data-household-number={householdNumber}>
        <div>{guestName}</div>
        <InvitedAttendingLine
          household={household}
          className='mt-0.5 font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'
        />
        <PartialEventAnswerLine
          guests={household.guests}
          events={events}
          className='mt-0.5 font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'
        />
      </td>
      <td className='px-4 py-3 text-foreground/70'>
        {primaryGuest?.phone ? <span dir='ltr'>{primaryGuest.phone}</span> : null}
      </td>
      <td className='px-4 py-3 text-foreground/70'>{household.side}</td>
      <td className='px-4 py-3 text-foreground/70'>{household.groupName}</td>
      <td className='px-4 py-3'>
        <Badge variant='outline'>{status}</Badge>
      </td>
      <td className='px-4 py-3'>
        <button
          type='button'
          className='rounded-sm border border-border px-2.5 py-1 font-mono text-[0.58rem] text-foreground/70 transition-colors hover:border-foreground/40 hover:bg-muted/50 hover:text-foreground'
          onClick={(event) => {
            event.stopPropagation()
            void handleCopyInvite()
          }}
        >
          {copied ? 'הועתק' : 'העתקה'}
        </button>
      </td>
    </tr>
  )
})
