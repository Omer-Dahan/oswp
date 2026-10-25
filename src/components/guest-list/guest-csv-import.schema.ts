/**
 * Guest CSV Import - Schema, Types & Parsing
 *
 * Contains all data definitions for the CSV import feature so the dialog
 * component stays focused on UI orchestration only.
 */

import Papa from 'papaparse'
import { z } from 'zod'

import { optionalPhoneSchemaNotNull } from '~/lib/phone/phone-validator'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const CSV_AGE_GROUPS = ['ADULT', 'CHILD', 'TEEN', 'INFANT'] as const

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === '' ? undefined : v))

export const guestCsvRowSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: optionalString.pipe(z.string().email('Invalid email').optional()),
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
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GuestCsvRowInput = z.input<typeof guestCsvRowSchema>
export type GuestCsvRowOutput = z.output<typeof guestCsvRowSchema>

export type ParsedCsvRow = {
  rowNumber: number
  raw: GuestCsvRowInput
} & ({ valid: true; data: GuestCsvRowOutput } | { valid: false; errors: string[] })

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
])

// Extra columns that don't map 1:1 to a schema field; folded into `notes`.
const EXTRA_FIELDS = new Set(['fullName', 'invitedCount', 'group'])

const HEBREW_HEADER_ALIASES: Record<string, string> = {
  'שם מלא': 'fullName',
  שם: 'fullName',
  'שם האורח': 'fullName',
  'שם פרטי': 'firstName',
  'שם משפחה': 'lastName',
  טלפון: 'phone',
  נייד: 'phone',
  פלאפון: 'phone',
  'מספר טלפון': 'phone',
  אימייל: 'email',
  מייל: 'email',
  'דוא"ל': 'email',
  "דוא'ל": 'email',
  כתובת: 'address1',
  'כתובת מלאה': 'address1',
  רחוב: 'address1',
  עיר: 'city',
  'עיר מגורים': 'city',
  מיקוד: 'zipCode',
  מחוז: 'state',
  אזור: 'state',
  מדינה: 'country',
  'קבוצת גיל': 'ageGroup',
  גיל: 'ageGroup',
  הערות: 'notes',
  הערה: 'notes',
  'מספר מוזמנים': 'invitedCount',
  'כמות מוזמנים': 'invitedCount',
  'כמות אורחים': 'invitedCount',
  'מספר אורחים': 'invitedCount',
  'כמות אנשים': 'invitedCount',
  צד: 'group',
  קבוצה: 'group',
  'צד/קבוצה': 'group',
  'קבוצת אורחים': 'group',
}

function transformHeader(header: string): string {
  const trimmed = header.trim()
  if (KNOWN_FIELDS.has(trimmed) || EXTRA_FIELDS.has(trimmed)) return trimmed
  return HEBREW_HEADER_ALIASES[trimmed] ?? trimmed
}

type RawCsvRow = GuestCsvRowInput & { fullName?: string; invitedCount?: string; group?: string }

// Splits a single "full name" column into first/last name when the couple's
// sheet doesn't have separate columns for them.
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  const [firstName, ...rest] = parts
  return { firstName: firstName ?? '', lastName: rest.join(' ') || (firstName ?? '') }
}

function normalizeRow(raw: RawCsvRow): GuestCsvRowInput {
  const { fullName, invitedCount, group, ...rest } = raw
  const normalized: GuestCsvRowInput = { ...rest }

  if (!normalized.firstName && !normalized.lastName && fullName) {
    const { firstName, lastName } = splitFullName(fullName)
    normalized.firstName = firstName
    normalized.lastName = lastName
  }

  const extraNotes = [
    group ? `צד/קבוצה: ${group}` : null,
    invitedCount ? `מספר מוזמנים: ${invitedCount}` : null,
  ].filter((v): v is string => Boolean(v))

  if (extraNotes.length > 0) {
    normalized.notes = [normalized.notes, ...extraNotes].filter(Boolean).join('; ')
  }

  return normalized
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const MAX_CSV_ROWS = 500

export function parseCsvFile(file: File): Promise<ParsedCsvRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader,
      complete: ({ data }) => {
        if (data.length > MAX_CSV_ROWS) {
          reject(new Error(`CSV exceeds the ${MAX_CSV_ROWS}-row limit (found ${data.length} rows)`))
          return
        }
        const rows = data.map((rawRow, index) => {
          const raw = normalizeRow(rawRow)
          const result = guestCsvRowSchema.safeParse(raw)
          if (result.success) {
            return { rowNumber: index + 2, raw, valid: true as const, data: result.data }
          }
          return {
            rowNumber: index + 2,
            raw,
            valid: false as const,
            errors: result.error.issues.map((i) => i.message),
          }
        })
        resolve(rows)
      },
      error: (err) => {
        reject(err)
      },
    })
  })
}
