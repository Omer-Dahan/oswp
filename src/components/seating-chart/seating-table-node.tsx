'use client'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useMemo } from 'react'

import {
  type DragData,
  getInitials,
  guestDragData,
  type TableDropData,
} from '~/components/seating-chart/seating-dnd'
import {
  getSeatPositions,
  getTableFootprint,
  getTableSurface,
  SEAT_SIZE,
} from '~/components/seating-chart/seating-layout'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'
import { getOccupiedSeats, tableHasRoom } from '~/server/domains/seating/seating.rules'
import type { SeatingGuest, SeatingTableView } from '~/server/domains/seating/seating.types'

type SeatingTableNodeProps = {
  table: SeatingTableView
  guestsById: ReadonlyMap<number, SeatingGuest>
  seatWeights: ReadonlyMap<number, number>
  onEdit: (tableId: string) => void
  onSelectGuest: (guestId: number) => void
}

// A seat is a SEAT_SIZE circle centred on its position
const seatStyle = (x: number, y: number) => ({
  left: x - SEAT_SIZE / 2,
  top: y - SEAT_SIZE / 2,
  width: SEAT_SIZE,
  height: SEAT_SIZE,
})

// One concrete chair on the plan: a named guest, or a "+1" member of a party
type SeatSlot = { guest: SeatingGuest; extra: boolean }

function ExtraSeat(props: Readonly<{ guest: SeatingGuest; x: number; y: number }>) {
  const { guest, x, y } = props
  const name = `${guest.firstName} ${guest.lastName}`.trim()
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <span
          aria-hidden='true'
          className='absolute flex items-center justify-center rounded-full border border-foreground/40 bg-muted text-[0.6rem] text-foreground/70 tabular-nums'
          style={seatStyle(x, y)}
        >
          +1
        </span>
      </TooltipTrigger>
      <TooltipContent>עוד אורח/ת מהמשפחה של {name}</TooltipContent>
    </Tooltip>
  )
}

function SeatedGuest(
  props: Readonly<{ guest: SeatingGuest; x: number; y: number; onSelect: () => void }>
) {
  const { guest, x, y, onSelect } = props
  const data = guestDragData(guest)
  const name = data.label
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `seat-guest:${guest.id}`,
    data,
  })

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          ref={setNodeRef}
          data-seating-focus-key={`seat-guest:${guest.id}`}
          type='button'
          aria-label={`${name}. Press Space to move, or Enter for details.`}
          onClick={onSelect}
          {...attributes}
          {...listeners}
          style={seatStyle(x, y)}
          className={cn(
            'absolute flex touch-manipulation items-center justify-center rounded-full border border-foreground/30 bg-card text-[0.6rem] text-foreground tabular-nums shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isDragging && 'opacity-30'
          )}
        >
          {getInitials(guest)}
        </button>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  )
}

export function SeatingTableNode(props: Readonly<SeatingTableNodeProps>) {
  const { table, guestsById, seatWeights, onEdit, onSelectGuest } = props
  const { footprint, surface, seats } = useMemo(
    () => ({
      footprint: getTableFootprint(table.shape, table.capacity),
      surface: getTableSurface(table.shape, table.capacity),
      seats: getSeatPositions(table.shape, table.capacity),
    }),
    [table.shape, table.capacity]
  )
  // Expand each household's party into concrete chair slots: every named guest
  // gets one chair, and the remaining (unnamed) party members fill "+1" chairs,
  // so an 8-person family visibly occupies 8 seats instead of one name + empties.
  const seatedSlots = useMemo(() => {
    const slots: SeatSlot[] = []
    const byHousehold = new Map<string, SeatingGuest[]>()
    for (const id of table.guestIds) {
      const guest = guestsById.get(id)
      if (!guest) continue
      const members = byHousehold.get(guest.householdId) ?? []
      members.push(guest)
      byHousehold.set(guest.householdId, members)
    }
    for (const members of byHousehold.values()) {
      // The primary contact carries the full party size in seatWeights
      const total = members.reduce(
        (max, guest) => Math.max(max, seatWeights.get(guest.id) ?? 1),
        0
      )
      for (const guest of members) slots.push({ guest, extra: false })
      const unnamed = Math.max(0, total - members.length)
      const primary = members.find((guest) => guest.isPrimaryContact) ?? members[0]
      if (primary) {
        for (let i = 0; i < unnamed; i++) slots.push({ guest: primary, extra: true })
      }
    }
    return slots
  }, [table.guestIds, guestsById, seatWeights])

  const dragData: DragData = { type: 'table', tableId: table.id }
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: `table:${table.id}`, data: dragData })

  const dropData: TableDropData = { type: 'table', tableId: table.id }
  // useDroppable's `active` only changes on drag start/end, unlike useDndContext,
  // which re-renders every table on every pointer move
  const {
    setNodeRef: setDropRef,
    isOver,
    active,
  } = useDroppable({ id: `table-drop:${table.id}`, data: dropData })

  const activeData = active?.data.current as DragData | undefined
  // Only guest drags target a table; a table dragged over another gets no cue
  const isGuestOver = isOver && activeData?.type === 'guests'
  const fits = !isGuestOver || tableHasRoom(table, activeData.guestIds, seatWeights)
  const occupiedSeats = getOccupiedSeats(table.guestIds, seatWeights)

  return (
    <div
      ref={setDropRef}
      className='absolute'
      style={{
        left: table.positionX,
        top: table.positionY,
        width: footprint.width,
        height: footprint.height,
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 20 : undefined,
      }}
    >
      {seats.map((seat, index) => {
        const slot = seatedSlots[index]
        if (!slot) {
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: empty seats have no identity
              key={`empty-${index}`}
              aria-hidden='true'
              className='absolute rounded-full border border-foreground/25 border-dashed'
              style={seatStyle(seat.x, seat.y)}
            />
          )
        }
        return slot.extra ? (
          <ExtraSeat
            key={`extra-${slot.guest.id}-${index}`}
            guest={slot.guest}
            x={seat.x}
            y={seat.y}
          />
        ) : (
          <SeatedGuest
            key={slot.guest.id}
            guest={slot.guest}
            x={seat.x}
            y={seat.y}
            onSelect={() => onSelectGuest(slot.guest.id)}
          />
        )
      })}

      <button
        ref={setDragRef}
        data-seating-focus-key={`table:${table.id}`}
        type='button'
        aria-label={`${table.name}, ${occupiedSeats} of ${table.capacity} seats filled. Press Space to move, or Enter to edit.`}
        onClick={() => onEdit(table.id)}
        {...attributes}
        {...listeners}
        style={{
          width: surface.width,
          height: surface.height,
          left: (footprint.width - surface.width) / 2,
          top: (footprint.height - surface.height) / 2,
        }}
        className={cn(
          'absolute flex cursor-grab touch-manipulation flex-col items-center justify-center border-2 bg-card px-2 text-center shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
          table.shape === 'ROUND' ? 'rounded-full' : 'rounded-md',
          isGuestOver && fits && 'border-success bg-success/10',
          isGuestOver && !fits && 'border-destructive bg-destructive/10',
          !isGuestOver && 'border-foreground/40'
        )}
      >
        <span className='line-clamp-2 font-medium text-foreground text-xs leading-tight'>
          {table.name}
        </span>
        <span
          className={cn(
            'text-[0.6rem] tabular-nums',
            occupiedSeats >= table.capacity ? 'text-success' : 'text-muted-foreground'
          )}
        >
          {occupiedSeats} / {table.capacity} מקומות תפוסים
        </span>
      </button>
    </div>
  )
}
