import type { Active, Over } from '@dnd-kit/core'

import {
  createSeatingAnnouncements,
  SEATING_SCREEN_READER_INSTRUCTIONS,
} from '~/components/seating-chart/seating-announcements'

const tables = {
  t1: { name: 'Head Table', capacity: 4, guestIds: [1, 2] },
  t2: { name: 'Kids Table', capacity: 2, guestIds: [3, 4] },
}
const announcements = createSeatingAnnouncements((id) => tables[id as keyof typeof tables])

const active = (data: unknown) => ({ id: 'x', data: { current: data } }) as unknown as Active
const over = (data: unknown) => ({ id: 'y', data: { current: data } }) as unknown as Over
const guests = (guestIds: number[], label: string) => active({ type: 'guests', guestIds, label })
const overTable = (tableId: string) => over({ type: 'table', tableId })

describe('seating announcements', () => {
  it('names the picked-up guest or table instead of an id', () => {
    expect(announcements.onDragStart({ active: guests([5], 'Ann Lee') })).toBe(
      'Ann Lee נבחר. השתמשו במקשי החצים כדי להעביר אותו לשולחן, במקש הרווח כדי לשחרר וב-Escape כדי לבטל.'
    )
    expect(announcements.onDragStart({ active: active({ type: 'table', tableId: 't1' }) })).toBe(
      'Head Table נבחר. השתמשו במקשי החצים כדי להזיז אותו, במקש הרווח כדי לשחרר וב-Escape כדי לבטל.'
    )
  })

  it('says how many seats are open when over a table', () => {
    expect(
      announcements.onDragOver?.({ active: guests([5], 'Ann Lee'), over: overTable('t1') })
    ).toBe('Ann Lee מעל Head Table, 2 מקומות פנויים.')
  })

  it('warns when the table does not have room', () => {
    expect(
      announcements.onDragOver?.({
        active: guests([5, 6, 7], 'Lee household'),
        over: overTable('t1'),
      })
    ).toBe('Lee household מעל Head Table, אין מספיק מקומות.')
  })

  it('announces the real outcome of a drop', () => {
    const ann = guests([5], 'Ann Lee')
    expect(announcements.onDragEnd({ active: ann, over: overTable('t1') })).toBe(
      'Ann Lee הושב ב-Head Table.'
    )
    expect(announcements.onDragEnd({ active: ann, over: overTable('t2') })).toBe(
      'אין מספיק מקומות ב-Kids Table. Ann Lee לא הועבר.'
    )
    expect(announcements.onDragEnd({ active: ann, over: over({ type: 'unassigned' }) })).toBe(
      'Ann Lee הועבר לרשימת האורחים ללא הושבה.'
    )
    expect(announcements.onDragEnd({ active: ann, over: null })).toBe(
      'Ann Lee לא שוחרר על שולחן ולא הועבר.'
    )
  })

  it('announces cancel and table drops', () => {
    expect(announcements.onDragCancel({ active: guests([5], 'Ann Lee'), over: null })).toBe(
      'העברת Ann Lee בוטלה.'
    )
    expect(
      announcements.onDragEnd({ active: active({ type: 'table', tableId: 't1' }), over: null })
    ).toBe('Head Table שוחרר.')
  })

  it('explains the keyboard controls', () => {
    expect(SEATING_SCREEN_READER_INSTRUCTIONS.draggable).toMatch(
      /הרווח.*החצים.*Escape.*Enter/s
    )
  })
})
