/**
 * Proves every column of the couple's real sheet is mapped correctly,
 * including the merged two-row header (section labels above the real
 * header row). Covers both the .xlsx and the .csv import paths.
 */

import { File as NodeFile } from 'node:buffer'

import ExcelJS from 'exceljs'

import { parseSpreadsheetFile } from '~/components/guest-list/guest-csv-import.schema'

// Upper label row, as it actually sits in the unmerged cells (Excel/Sheets
// only stores a value in the top-left cell of a merged range — the rest of
// the range is blank underneath). Section labels: שיוך (over צד/קבוצה),
// פרטי התקשרות (over סלולרי/אימייל), כתובת (over עיר/רחוב/מיקוד/תא דואר).
const UPPER_LABEL_ROW = [
  'עמודה1',
  'עמודה2',
  'שיוך',
  'עמודה3',
  'פרטי התקשרות',
  'עמודה4',
  'עמודה5',
  'כתובת',
  '',
  '',
  '',
  '',
]

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
  ['שי אלון', 1, 'חתן', 'אבא - חברים', '052-2383134', '02-9979970', 'shaibetel@gmail.com', '', '', '', '', ''],
  ['יניב קנדל', 2, 'חתן', 'אבא - חברים', '052-8209431', '', 'yanivkendel@gmail.com', '', '', '', '', ''],
  ['נטי פונפון', 2, 'כלה', 'אבא - חברים', '054-6713826', '', 'natiponpon@walla.co.il', '', '', '', '', ''],
]

function toNodeFile(buffer: ArrayBuffer | Buffer | string, name: string, type: string): File {
  // jsdom's global File lacks arrayBuffer(); use Node's buffer.File, which
  // has it, instead of the environment's broken built-in.
  return new NodeFile([buffer], name, { type }) as unknown as File
}

async function makeXlsxFile(): Promise<File> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Guests')

  sheet.addRow(UPPER_LABEL_ROW)
  sheet.addRow(REAL_HEADER_ROW)
  DATA_ROWS.forEach((row) => sheet.addRow(row))

  const buffer = await workbook.xlsx.writeBuffer()
  return toNodeFile(buffer, 'guests.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

function makeCsvFile(): File {
  const lines = [UPPER_LABEL_ROW, REAL_HEADER_ROW, ...DATA_ROWS].map((row) => row.map((cell) => `${cell}`).join(','))
  return new File([lines.join('\n')], 'guests.csv', { type: 'text/csv' })
}

function assertRows(rows: Awaited<ReturnType<typeof parseSpreadsheetFile>>) {
  expect(rows).toHaveLength(3)
  expect(rows.every((r) => r.valid)).toBe(true)

  const [row1, row2, row3] = rows

  if (row1?.valid) {
    expect(row1.raw.firstName).toBe('שי')
    expect(row1.raw.lastName).toBe('אלון')
    expect(row1.data.invitedCount).toBe(1)
    expect(row1.data.side).toBe('חתן')
    expect(row1.data.groupName).toBe('אבא - חברים')
    expect(row1.data.phone?.startsWith('+972')).toBe(true)
    expect(row1.data.phoneAlt).toBe('02-9979970')
    expect(row1.data.email).toBe('shaibetel@gmail.com')
    expect(row1.data.city).toBeUndefined()
    expect(row1.data.address1).toBeUndefined()
    expect(row1.data.zipCode).toBeUndefined()
    expect(row1.data.address2).toBeUndefined()
    expect(row1.data.expectedCheck).toBeUndefined()
  }

  if (row2?.valid) {
    expect(`${row2.raw.firstName} ${row2.raw.lastName}`).toBe('יניב קנדל')
    expect(row2.data.invitedCount).toBe(2)
    expect(row2.data.email).toBe('yanivkendel@gmail.com')
  }

  if (row3?.valid) {
    expect(`${row3.raw.firstName} ${row3.raw.lastName}`).toBe('נטי פונפון')
    expect(row3.data.invitedCount).toBe(2)
    expect(row3.data.side).toBe('כלה')
    expect(row3.data.email).toBe('natiponpon@walla.co.il')
  }
}

describe('import against the real sheet header (two-row header)', () => {
  it('maps every column from the .xlsx import', async () => {
    const rows = await parseSpreadsheetFile(await makeXlsxFile())
    assertRows(rows)
  })

  it('maps every column from the .csv import identically', async () => {
    const rows = await parseSpreadsheetFile(makeCsvFile())
    assertRows(rows)
  })
})

describe('a bad email warns instead of dropping the household', () => {
  const BAD_EMAIL_ROWS: (string | number)[][] = [
    ['דני כהן', 1, 'חתן', 'אבא - חברים', '052-1111111', '', 'not-an-email', '', '', '', '', ''],
    ['רונית לוי', 1, 'כלה', 'אבא - חברים', '052-2222222', '', 'a@b.co.il', '', '', '', '', ''],
  ]

  function makeBadEmailCsvFile(): File {
    const lines = [UPPER_LABEL_ROW, REAL_HEADER_ROW, ...BAD_EMAIL_ROWS].map((row) =>
      row.map((cell) => `${cell}`).join(',')
    )
    return new File([lines.join('\n')], 'guests.csv', { type: 'text/csv' })
  }

  it('keeps the row valid, drops the email, and adds a warning for an invalid address', async () => {
    const rows = await parseSpreadsheetFile(makeBadEmailCsvFile())
    expect(rows).toHaveLength(2)

    const [row1, row2] = rows

    expect(row1?.valid).toBe(true)
    if (row1?.valid) {
      expect(row1.data.email).toBeUndefined()
      expect(row1.warnings).toEqual(['כתובת המייל אינה תקינה — האורח ייובא בלי מייל'])
    }

    expect(row2?.valid).toBe(true)
    if (row2?.valid) {
      expect(row2.data.email).toBe('a@b.co.il')
      expect(row2.warnings).toBeUndefined()
    }
  })
})
