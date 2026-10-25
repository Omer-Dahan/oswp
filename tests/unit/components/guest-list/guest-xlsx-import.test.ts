/**
 * Tests for Excel (.xlsx) guest import via parseSpreadsheetFile().
 *
 * Builds an in-memory workbook matching the couple's real sheet layout
 * (3 section-label rows, then the Hebrew header row, then data).
 */

import { File as NodeFile } from 'node:buffer'

import ExcelJS from 'exceljs'

import { parseSpreadsheetFile } from '~/components/guest-list/guest-csv-import.schema'

async function makeXlsxFile(): Promise<File> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Guests')

  sheet.addRow(['שיוך'])
  sheet.addRow(['פרטי התקשרות'])
  sheet.addRow(['כתובת'])
  sheet.addRow([
    'הזמנה לכבוד',
    "מס' אורחים שהוזמנו",
    'צד',
    'קבוצה',
    'סלולרי',
    'טלפון רגיל',
    'אימייל',
    'עיר',
    'רחוב',
    'מיקוד',
    'תא דואר',
    "צ'ק צפוי",
  ])
  sheet.addRow([
    'משפחת ישראלי',
    3,
    'כלה',
    'משפחה',
    '0521234567',
    '03-1234567',
    'a@b.co.il',
    'תל אביב',
    'הרצל 1',
    6100000,
    12,
    500,
  ])

  const buffer = await workbook.xlsx.writeBuffer()

  // jsdom's global File lacks arrayBuffer(); use Node's buffer.File, which
  // has it, instead of the environment's broken built-in.
  return new NodeFile([buffer], 'guests.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }) as unknown as File
}

describe('parseSpreadsheetFile (.xlsx)', () => {
  it('parses the couple’s real sheet layout', async () => {
    const file = await makeXlsxFile()

    const rows = await parseSpreadsheetFile(file)

    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row?.valid).toBe(true)
    if (row?.valid) {
      expect(`${row.raw.firstName} ${row.raw.lastName}`).toContain('ישראלי')
      expect(row.data.city).toBe('תל אביב')
      expect(row.data.phone?.startsWith('+972')).toBe(true)
    }
  })
})
