'use client'

import Link from 'next/link'

import { getRsvpBadgeClassName } from '~/components/guest-list/guest-detail-panel-content'
import { GuestDetailDrawer } from '~/components/guest-list/v2/drawer/guest-detail-drawer'
import {
  GuestDetailSection,
  GuestDetailSections,
} from '~/components/guest-list/v2/drawer/guest-detail-sections'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { AGE_GROUP_OPTIONS } from '~/lib/constants/guest'
import { formatGuestName } from '~/lib/seating/guest-name'
import { cn } from '~/lib/utils'
import { getOpenSeats } from '~/server/domains/seating/seating.rules'
import type {
  SeatingGuest,
  SeatingHousehold,
  SeatingTableView,
} from '~/server/domains/seating/seating.types'

type SeatingGuestDrawerProps = {
  guest: SeatingGuest | null
  household: SeatingHousehold | null
  tables: SeatingTableView[]
  onClose: () => void
  onSelectGuest: (guestId: number) => void
  onUnseat: (guestId: number) => void
  onSeat: (guestId: number, tableId: string) => void
  onCloseAutoFocus?: (event: Event) => void
}

function DetailRow(props: Readonly<{ label: string; value: string | null }>) {
  return (
    <div className='flex justify-between gap-4'>
      <span>{props.label}</span>
      <span className='text-end text-foreground'>{props.value || '—'}</span>
    </div>
  )
}

export function SeatingGuestDrawer(props: Readonly<SeatingGuestDrawerProps>) {
  const { guest, household, tables, onClose, onSelectGuest, onUnseat, onSeat, onCloseAutoFocus } =
    props
  const tableName = (tableId: string | null) =>
    tables.find((table) => table.id === tableId)?.name ?? null
  const seatedAt = guest ? tableName(guest.tableId) : null

  return (
    <GuestDetailDrawer
      open={guest !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      onCloseAutoFocus={onCloseAutoFocus}
      title={guest ? formatGuestName(guest) : 'Guest details'}
      subtitle={seatedAt ? `Seated at ${seatedAt}` : 'Not seated yet'}
      headerMeta={
        guest ? (
          <div className='flex flex-wrap gap-1.5'>
            <Badge
              variant='outline'
              className={cn(
                'text-[0.58rem] uppercase tracking-wider',
                getRsvpBadgeClassName(guest.rsvp)
              )}
            >
              {guest.rsvp}
            </Badge>
            {guest.tags.map((tag) => (
              <Badge
                key={tag}
                variant='outline'
                className='border-foreground/15 bg-foreground/[0.04] text-[0.58rem] text-foreground/70 uppercase tracking-wider'
              >
                {tag}
              </Badge>
            ))}
          </div>
        ) : null
      }
      footer={
        <Button asChild variant='outline' className='w-full'>
          <Link href='/guest-list'>עריכה ברשימת האורחים</Link>
        </Button>
      }
    >
      {guest ? (
        <GuestDetailSections>
          <GuestDetailSection
            title='הושבה'
            action={
              guest.tableId ? (
                <Button size='sm' variant='ghost' onClick={() => onUnseat(guest.id)}>
                  הסרה מהשולחן
                </Button>
              ) : null
            }
          >
            {/* Seating without dragging (keyboard, touch, screen readers). Always
                controlled: '' shows the placeholder, so a previous guest's pick
                never lingers in Radix's internal state */}
            <Select
              value={guest.tableId ?? ''}
              onValueChange={(tableId) => {
                if (tableId !== guest.tableId) onSeat(guest.id, tableId)
              }}
            >
              <SelectTrigger aria-label='הושבה ליד שולחן'>
                <SelectValue
                  placeholder={tables.length === 0 ? 'Add a table first' : 'Unassigned'}
                />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => {
                  const open = getOpenSeats(table)
                  const isOwnTable = table.id === guest.tableId
                  return (
                    <SelectItem key={table.id} value={table.id} disabled={open <= 0 && !isOwnTable}>
                      {table.name} ({open <= 0 ? 'full' : `${open} open`})
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </GuestDetailSection>

          <GuestDetailSection title='אורח' contentClassName='space-y-1.5'>
            <DetailRow label='דוא״ל' value={guest.email} />
            <DetailRow label='טלפון' value={guest.phone} />
            <DetailRow
              label='קבוצת גיל'
              value={
                AGE_GROUP_OPTIONS.find((option) => option.value === (guest.ageGroup ?? 'ADULT'))
                  ?.label ?? null
              }
            />
            <DetailRow label='צרכים תזונתיים' value={guest.dietaryRestrictions} />
            {guest.isTagAlong ? <DetailRow label='נלווה' value='Yes' /> : null}
          </GuestDetailSection>

          {household ? (
            <GuestDetailSection title='משק בית' contentClassName='space-y-3'>
              <ul className='space-y-1'>
                {household.guests.map((member) => (
                  <li key={member.id} className='flex items-center justify-between gap-3'>
                    <button
                      type='button'
                      onClick={() => onSelectGuest(member.id)}
                      className={
                        member.id === guest.id
                          ? 'font-medium text-foreground'
                          : 'text-foreground/80 underline-offset-2 hover:underline'
                      }
                    >
                      {formatGuestName(member)}
                      {member.isPrimaryContact ? ' (primary)' : ''}
                    </button>
                    <span className='text-xs'>{tableName(member.tableId) ?? 'Unassigned'}</span>
                  </li>
                ))}
              </ul>
              {household.address ? <p>{household.address}</p> : null}
              {household.notes ? <p className='whitespace-pre-wrap'>{household.notes}</p> : null}
            </GuestDetailSection>
          ) : null}
        </GuestDetailSections>
      ) : null}
    </GuestDetailDrawer>
  )
}
