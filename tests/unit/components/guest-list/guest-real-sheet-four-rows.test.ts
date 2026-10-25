/**
 * Proves the importer accepts the couple's four real data rows, including
 * one row with no mobile and only a landline, two rows with no landline at
 * all, and a numeric צ'ק צפוי cell. Covers both the .xlsx and the .csv
 * import paths.
 */

import { File as NodeFile } from 'node:buffer'

import ExcelJS from 'exceljs'

import { parseSpreadsheetFile } from '~/components/guest-list/guest-csv-import.schema'

// Row 0: merged section labels, simulated as plain unmerged cells.
// C2=שיוך (over C2-C3), C4=פרטי התקשרות (over C4-C6), C7=כתובת (over C7-C10), C11 empty.
const UPPER_LABEL_ROW = ['', '', 'שיוך', '', 'פרטי התקשרות', '', '', 'כתובת', '', '', '', '']

const REAL_HEADER_ROW = [
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
]

const DATA_ROWS: (string | number)[][] = [
  ['אבי כהן', 2, 'חתן', 'חברים', '', '', '', 'תל אביב', 'איינשטיין', '', '', 1000],
  ['ישראל לוי', 1, 'כלה', 'משפחה', '', '03-1234567', '', 'חיפה', 'צה"ל', '', '', 500],
  ['משפחת ישראלי', 5, 'חתן', 'אמא - עבודה', '050-1234567', '', '', '', '', '', '', ''],
  ['אביבה ואביב אביבי', 2, 'כלה', 'אבא - חברים', '052-0000000', '', '', '', '', '', '', ''],
]

function toNodeFile(buffer: ArrayBuffer | Buffer | string, name: string, type: string): File {
  // jsdom's global File lacks arrayBuffer(); use Node's buffer.File, which
  // has it, instead of the environment's broken built-in.
  return new NodeFile([buffer], name, { type }) as unknown as File
}

async function makeXlsxFile(): Promise<File> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('הזמנות')

  sheet.addRow(UPPER_LABEL_ROW)
  sheet.addRow(REAL_HEADER_ROW)
  DATA_ROWS.forEach((row) => sheet.addRow(row))

  const buffer = await workbook.xlsx.writeBuffer()
  return toNodeFile(buffer, 'guests.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

function csvCell(value: string | number): string {
  const text = `${value}`
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function makeCsvFile(): File {
  const lines = [UPPER_LABEL_ROW, REAL_HEADER_ROW, ...DATA_ROWS].map((row) => row.map(csvCell).join(','))
  return new File([lines.join('\n')], 'guests.csv', { type: 'text/csv' })
}

function assertRows(rows: Awaited<ReturnType<typeof parseSpreadsheetFile>>) {
  expect(rows).toHaveLength(4)
  expect(rows.every((r) => r.valid)).toBe(true)

  const [r2, r3, r4, r5] = rows

  if (r2?.valid) {
    expect(r2.raw.firstName).toBe('אבי')
    expect(r2.raw.lastName).toBe('כהן')
    expect(r2.data.invitedCount).toBe(2)
    expect(r2.data.side).toBe('חתן')
    expect(r2.data.groupName).toBe('חברים')
    expect(r2.data.phone).toBeUndefined()
    expect(r2.data.phoneAlt).toBeUndefined()
    expect(r2.data.city).toBe('תל אביב')
    expect(r2.data.address1).toBe('איינשטיין')
    expect(r2.data.expectedCheck).toBe(1000)
  }

  if (r3?.valid) {
    expect(r3.raw.firstName).toBe('ישראל')
    expect(r3.raw.lastName).toBe('לוי')
    expect(r3.data.invitedCount).toBe(1)
    expect(r3.data.side).toBe('כלה')
    expect(r3.data.groupName).toBe('משפחה')
    expect(r3.data.phone).toBeUndefined()
    expect(r3.data.phoneAlt).toBe('03-1234567')
    expect(r3.data.city).toBe('חיפה')
    expect(r3.data.address1).toBe('צה"ל')
    expect(r3.data.expectedCheck).toBe(500)
  }

  if (r4?.valid) {
    expect(r4.raw.firstName).toBe('משפחת')
    expect(r4.raw.lastName).toBe('ישראלי')
    expect(r4.data.invitedCount).toBe(5)
    expect(r4.data.side).toBe('חתן')
    expect(r4.data.groupName).toBe('אמא - עבודה')
    expect(r4.data.phone?.startsWith('+972')).toBe(true)
    expect(r4.data.phoneAlt).toBeUndefined()
    expect(r4.data.city).toBeUndefined()
    expect(r4.data.address1).toBeUndefined()
    expect(r4.data.expectedCheck).toBeUndefined()
  }

  if (r5?.valid) {
    expect(r5.raw.firstName).toBe('אביבה ואביב')
    expect(r5.raw.lastName).toBe('אביבי')
    expect(r5.data.invitedCount).toBe(2)
    expect(r5.data.side).toBe('כלה')
    expect(r5.data.groupName).toBe('אבא - חברים')
    expect(r5.data.phone?.startsWith('+972')).toBe(true)
    expect(r5.data.phoneAlt).toBeUndefined()
    expect(r5.data.city).toBeUndefined()
    expect(r5.data.address1).toBeUndefined()
    expect(r5.data.expectedCheck).toBeUndefined()
  }
}

describe('import of the couple\'s four real rows (no-mobile and landline-only guests)', () => {
  it('accepts all four rows from the .xlsx import', async () => {
    const rows = await parseSpreadsheetFile(await makeXlsxFile())
    assertRows(rows)
  })

  it('accepts all four rows from the .csv import identically', async () => {
    const rows = await parseSpreadsheetFile(makeCsvFile())
    assertRows(rows)
  })
})
