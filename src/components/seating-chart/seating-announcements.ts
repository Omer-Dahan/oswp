import type { Announcements, ScreenReaderInstructions } from '@dnd-kit/core'

import type { DragData, DropData } from '~/components/seating-chart/seating-dnd'
import { getOpenSeats, tableHasRoom } from '~/server/domains/seating/seating.rules'

type TableInfo = { name: string; capacity: number; guestIds: readonly number[] }

export const SEATING_SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'כדי להרים אורח, משק בית או שולחן, לחצו על מקש הרווח. השתמשו במקשי החצים כדי להזיז, ' +
    'במקש הרווח כדי לשחרר וב-Escape כדי לבטל. לחילופין, לחצו על Enter כדי לפתוח פרטים.',
}

/**
 * Spoken feedback for keyboard and screen reader drags, using guest and table
 * names (dnd-kit's defaults read out internal ids).
 */
export const createSeatingAnnouncements = (
  getTable: (tableId: string) => TableInfo | undefined
): Announcements => {
  const dragOf = (active: { data: { current?: unknown } }) =>
    active.data.current as DragData | undefined
  const dropOf = (over: { data: { current?: unknown } } | null) =>
    over?.data.current as DropData | undefined

  const nameOf = (data: DragData | undefined) => {
    if (data?.type === 'guests') return data.label
    if (data?.type === 'table') return getTable(data.tableId)?.name ?? 'שולחן'
    return 'פריט'
  }

  const tableFor = (drop: DropData | undefined) =>
    drop?.type === 'table' ? getTable(drop.tableId) : undefined

  return {
    onDragStart: ({ active }) => {
      const data = dragOf(active)
      const how = data?.type === 'table' ? 'להזיז אותו' : 'להעביר אותו לשולחן'
      return `${nameOf(data)} נבחר. השתמשו במקשי החצים כדי ${how}, במקש הרווח כדי לשחרר וב-Escape כדי לבטל.`
    },
    onDragOver: ({ active, over }) => {
      const data = dragOf(active)
      if (data?.type !== 'guests') return undefined
      const drop = dropOf(over)
      if (drop?.type === 'unassigned') return `${data.label} מעל רשימת האורחים ללא הושבה.`
      const table = tableFor(drop)
      if (!table) return `${data.label} לא מעל שולחן.`
      if (!tableHasRoom(table, data.guestIds)) {
        return `${data.label} מעל ${table.name}, אין מספיק מקומות.`
      }
      const open = getOpenSeats(table)
      return `${data.label} מעל ${table.name}, ${open === 1 ? 'מקום פנוי אחד' : `${open} מקומות פנויים`}.`
    },
    onDragEnd: ({ active, over }) => {
      const data = dragOf(active)
      // Neutral wording: dnd-kit does not pass the drag distance here, so a
      // table dropped in place cannot be told apart from one that moved
      if (data?.type !== 'guests') return `${nameOf(data)} שוחרר.`
      const drop = dropOf(over)
      if (drop?.type === 'unassigned') return `${data.label} הועבר לרשימת האורחים ללא הושבה.`
      const table = tableFor(drop)
      if (!table) return `${data.label} לא שוחרר על שולחן ולא הועבר.`
      if (!tableHasRoom(table, data.guestIds)) {
        return `אין מספיק מקומות ב-${table.name}. ${data.label} לא הועבר.`
      }
      return `${data.label} הושב ב-${table.name}.`
    },
    onDragCancel: ({ active }) => `העברת ${nameOf(dragOf(active))} בוטלה.`,
  }
}
