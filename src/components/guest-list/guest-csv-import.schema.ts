/**
 * Guest CSV Import - Schema, Types & Parsing
 *
 * Contains all data definitions for the CSV import feature so the dialog
 * component stays focused on UI orchestration only.
 */

import type ExcelJS from 'exceljs'
import Papa from 'papaparse'
import { z } from 'zod'

import { normalizePhoneToE164, optionalPhoneSchemaNotNull } from '~/lib/phone/phone-validator'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const CSV_AGE_GROUPS = ['ADULT', 'CHILD', 'TEEN', 'INFANT'] as const

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === '' ? undefined : v))

const optionalInt = (min: number, max: number) =>
  optionalString.pipe(
    z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : Number(v)))
      .pipe(z.number().int().min(min).max(max).optional())
  )

const optionalMoney = optionalString.pipe(
  z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      const cleaned = v.replace(/[₪,\s]/g, '')
      return cleaned === '' ? undefined : Number(cleaned)
    })
    .pipe(z.number().min(0).optional())
)

export const guestCsvRowSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z
    .string()
    .optional()
    .transform((v) => v ?? ''),
  email: optionalString.transform((v) =>
    v === undefined ? undefined : z.string().email().safeParse(v).success ? v : undefined
  ),
  phone: optionalString.pipe(optionalPhoneSchemaNotNull),
  ageGroup: z
    .string()
    .optional()
    .transform((v) => {
      const upper = (v ?? '').toUpperCase()
      return CSV_AGE_GROUPS.includes(upper as (typeof CSV_AGE_GROUPS)[number]) ? upper : 'ADULT'
    })
    .pipe(z.enum(CSV_AGE_GROUPS)),
  address1: optionalString,
  address2: optionalString,
  city: optionalString,
  state: optionalString,
  zipCode: optionalString,
  country: optionalString,
  notes: optionalString,
  invitedCount: optionalInt(0, 50).transform((v) => (v === 0 ? undefined : v)),
  side: optionalString.pipe(z.string().max(40).optional()),
  groupName: optionalString.pipe(z.string().max(60).optional()),
  phoneAlt: optionalString.pipe(z.string().max(40).optional()),
  expectedCheck: optionalMoney,
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GuestCsvRowInput = z.input<typeof guestCsvRowSchema>
export type GuestCsvRowOutput = z.output<typeof guestCsvRowSchema>

export type ParsedCsvRow = {
  rowNumber: number
  raw: GuestCsvRowInput
} & (
  | { valid: true; data: GuestCsvRowOutput; warnings?: string[] }
  | { valid: false; errors: string[] }
)

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

const TEMPLATE_HEADERS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'ageGroup',
  'address1',
  'address2',
  'city',
  'state',
  'zipCode',
  'country',
  'notes',
]

const TEMPLATE_CSV =
  TEMPLATE_HEADERS.join(',') +
  '\nJohn,Smith,john@example.com,+12025550123,ADULT,123 Main St,,New York,NY,10001,USA,\nJane,Doe,,,,,,,,,,\n'

export function downloadGuestCsvTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'guest-import-template.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

// ---------------------------------------------------------------------------
// Header aliases (the couple's Hebrew Excel export uses its own column names)
// ---------------------------------------------------------------------------

const KNOWN_FIELDS = new Set([
  'firstName',
  'lastName',
  'email',
  'phone',
  'ageGroup',
  'address1',
  'address2',
  'city',
  'state',
  'zipCode',
  'country',
  'notes',
  'invitedCount',
  'side',
  'groupName',
  'phoneAlt',
  'expectedCheck',
])

const EXTRA_FIELDS = new Set(['fullName'])
const IGNORED_FIELD = '__ignored__'

// Keys are stored in normalised form: quotes/geresh/gershayim/periods/colons
// stripped, inner whitespace collapsed, trimmed.
const HEBREW_HEADER_ALIASES: Record<string, string> = {
  'הזמנה לכבוד': 'fullName',
  'שם מלא': 'fullName',
  'שם האורח': 'fullName',
  שם: 'fullName',
  'שם פרטי': 'firstName',
  'שם משפחה': 'lastName',

  סלולרי: 'phone',
  נייד: 'phone',
  פלאפון: 'phone',
  'טלפון נייד': 'phone',
  טלפון: 'phone',
  'מספר טלפון': 'phone',
  'טלפון רגיל': 'phoneAlt',
  'טלפון קווי': 'phoneAlt',

  אימייל: 'email',
  מייל: 'email',
  דואל: 'email',

  רחוב: 'address1',
  כתובת: 'address1',
  'כתובת מלאה': 'address1',
  עיר: 'city',
  'עיר מגורים': 'city',
  מיקוד: 'zipCode',
  מחוז: 'state',
  אזור: 'state',
  מדינה: 'country',
  'תא דואר': 'address2',

  צד: 'side',
  קבוצה: 'groupName',
  'צד/קבוצה': 'groupName',
  'קבוצת אורחים': 'groupName',

  'מס אורחים שהוזמנו': 'invitedCount',
  'מס אורחים': 'invitedCount',
  'מספר אורחים': 'invitedCount',
  'כמות אורחים': 'invitedCount',
  'מספר מוזמנים': 'invitedCount',
  'כמות מוזמנים': 'invitedCount',
  'כמות אנשים': 'invitedCount',

  'צק צפוי': 'expectedCheck',
  'צ ק צפוי': 'expectedCheck',

  'קבוצת גיל': 'ageGroup',
  הערות: 'notes',
  הערה: 'notes',
}

function normalizeHeaderKey(header: string): string {
  return header
    .replace(/[׳״"'`]/g, ' ')
    .replace(/[.:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function transformHeader(header: string): string {
  const raw = header.trim()
  if (KNOWN_FIELDS.has(raw) || EXTRA_FIELDS.has(raw)) return raw
  const key = normalizeHeaderKey(raw)
  return HEBREW_HEADER_ALIASES[key] ?? IGNORED_FIELD
}

type RawCsvRow = GuestCsvRowInput & {
  fullName?: string
  [IGNORED_FIELD]?: string
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1]! }
}

function normalizeRow(input: RawCsvRow): GuestCsvRowInput {
  const { fullName, [IGNORED_FIELD]: _ignored, ...rest } = input
  const normalized: GuestCsvRowInput = { ...rest }

  if (!normalized.firstName && fullName) {
    const { firstName, lastName } = splitFullName(fullName)
    normalized.firstName = firstName
    normalized.lastName = lastName
  }

  if (normalized.phone) {
    normalized.phone = normalizePhoneToE164(normalized.phone, 'IL') ?? normalized.phone
  }

  return normalized
}

// ---------------------------------------------------------------------------
// Header row detection (the couple's sheet often has a title/blank row
// above the real header row — scan the first few rows to find it)
// ---------------------------------------------------------------------------

const HEADER_SEARCH_LIMIT = 10
const MIN_RECOGNIZED_HEADERS = 2

function isRecognizedField(field: string): boolean {
  return KNOWN_FIELDS.has(field) || EXTRA_FIELDS.has(field) || transformHeader(field) !== IGNORED_FIELD
}

const SECTION_LABEL_MARKERS = ['שיוך', 'פרטי התקשרות', 'כתובת']

function isSectionLabelRow(row: string[]): boolean {
  return row.some((cell) => SECTION_LABEL_MARKERS.includes(cell.trim()))
}

function detectHeaderRowIndex(rows: string[][]): number {
  const limit = Math.min(rows.length, HEADER_SEARCH_LIMIT)
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? []
    if (isSectionLabelRow(row)) continue
    const recognizedCount = row.map(transformHeader).filter(isRecognizedField).length
    if (recognizedCount >= MIN_RECOGNIZED_HEADERS) return i
  }
  return 0
}

function rowsToRawCsvRow(headers: string[], values: string[]): RawCsvRow {
  const row: Record<string, string> = {}
  headers.forEach((header, i) => {
    if (header && values[i] !== undefined && values[i] !== '') row[header] = values[i]
  })
  return row as RawCsvRow
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const MAX_CSV_ROWS = 500

function rowsToParsedRows(data: string[][]): ParsedCsvRow[] {
  const dataRowCount = Math.max(data.length - 1, 0)
  if (dataRowCount > MAX_CSV_ROWS) {
    throw new Error(`CSV exceeds the ${MAX_CSV_ROWS}-row limit (found ${dataRowCount} rows)`)
  }
  const headerRowIndex = detectHeaderRowIndex(data)
  const headers = data[headerRowIndex]?.map(transformHeader) ?? []
  const dataRows = data.slice(headerRowIndex + 1)

  return dataRows.map((values, index) => {
    const raw = normalizeRow(rowsToRawCsvRow(headers, values))
    const result = guestCsvRowSchema.safeParse(raw)
    const rowNumber = headerRowIndex + index + 2
    if (result.success) {
      const warnings: string[] = []
      if (raw.email && result.data.email === undefined) {
        warnings.push('כתובת המייל אינה תקינה — האורח ייובא בלי מייל')
      }
      return {
        rowNumber,
        raw,
        valid: true as const,
        data: result.data,
        ...(warnings.length > 0 ? { warnings } : {}),
      }
    }
    return {
      rowNumber,
      raw,
      valid: false as const,
      errors: result.error.issues.map((i) => i.message),
    }
  })
}

export function parseCsvFile(file: File): Promise<ParsedCsvRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: ({ data }) => {
        try {
          resolve(rowsToParsedRows(data))
        } catch (err) {
          reject(err)
        }
      },
      error: (err) => {
        reject(err)
      },
    })
  })
}

function cellToText(cell: ExcelJS.Cell): string {
  const text = cell.text
  return text ?? ''
}

function isRowEmpty(row: string[]): boolean {
  return row.every((cell) => cell.trim() === '')
}

async function parseXlsxFile(file: File): Promise<ParsedCsvRow[]> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const worksheet = workbook.worksheets[0]
  if (!worksheet) return []

  const data: string[][] = []
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values: string[] = []
    for (let i = 1; i <= row.cellCount; i++) {
      values.push(cellToText(row.getCell(i)))
    }
    data.push(values)
  })

  while (data.length > 0 && isRowEmpty(data[data.length - 1]!)) {
    data.pop()
  }

  return rowsToParsedRows(data)
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedCsvRow[]> {
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  if (extension === '.csv') return parseCsvFile(file)
  if (extension === '.xlsx') return parseXlsxFile(file)
  if (extension === '.xls') {
    throw new Error('קבצי .xls אינם נתמכים — שמרו את הגיליון כ-.xlsx')
  }
  throw new Error('סוג קובץ לא נתמך — .csv או .xlsx בלבד')
}
