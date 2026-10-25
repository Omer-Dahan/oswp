/**
 * Hebrew date computation — pure, no React, no Prisma.
 *
 * Gematriya day/year come from @hebcal/hdate's gematriya(); Hebrew month
 * names are not provided by that package (only @hebcal/core ships locale
 * data), so they're hardcoded here.
 */

import { HDate, gematriya } from '@hebcal/hdate'

const HEBREW_MONTH_NAMES: Record<number, string> = {
  1: 'ניסן',
  2: 'אייר',
  3: 'סיוון',
  4: 'תמוז',
  5: 'אב',
  6: 'אלול',
  7: 'תשרי',
  8: 'חשוון',
  9: 'כסלו',
  10: 'טבת',
  11: 'שבט',
  12: 'אדר',
  13: "אדר ב׳",
}

function hebrewMonthName(month: number, isLeapYear: boolean): string {
  if (isLeapYear && month === 12) return "אדר א׳"
  return HEBREW_MONTH_NAMES[month] ?? ''
}

export function computeHebrewDate(date: Date): string {
  // `date` is a date-only `@db.Date` value stored as UTC midnight (same
  // convention as src/app/utils/helpers.ts calculateDaysRemaining). Rebuild
  // it as a *local* midnight with the same Y/M/D so HDate — which reads the
  // Date's local getFullYear/getMonth/getDate — isn't shifted by the
  // server process's own timezone.
  const localDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const hdate = new HDate(localDate)
  const year = hdate.getFullYear()
  const isLeapYear = HDate.isLeapYear(year)

  const day = gematriya(hdate.getDate())
  const month = hebrewMonthName(hdate.getMonth(), isLeapYear)
  const yearGematriya = gematriya(year)

  return `${day} ב${month} ${yearGematriya}`
}

export function hebrewDateFor(event: {
  date: Date | null
  hebrewDateOverride: string | null
}): string | null {
  if (event.hebrewDateOverride && event.hebrewDateOverride.trim().length > 0) {
    return event.hebrewDateOverride
  }
  if (!event.date) return null
  return computeHebrewDate(event.date)
}
