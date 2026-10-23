/**
 * WhatsApp Domain - Pure queueing rules
 *
 * Shared by the service (authoritative checks) so the daily-cap and
 * already-sent skip logic can be unit tested without a database.
 */

import { normalisePhone } from '~/server/domains/whatsapp/phone-mapping'

export const DAILY_RECIPIENT_CAP = 250

export type PhoneCandidate = {
  phone: string
}

export type CapAllocation<T> = {
  toQueue: T[]
  overCap: T[]
}

/**
 * Splits candidates into those that fit within the rolling-24h unique
 * recipient cap and those that don't. A phone already counted in the window
 * (e.g. a resend to someone already messaged today) never consumes
 * additional cap headroom.
 */
export function allocateWithinDailyCap<T extends PhoneCandidate>(
  candidates: readonly T[],
  phonesAlreadyCountedInWindow: ReadonlySet<string>,
  cap: number = DAILY_RECIPIENT_CAP
): CapAllocation<T> {
  const counted = new Set(phonesAlreadyCountedInWindow)
  const toQueue: T[] = []
  const overCap: T[] = []

  for (const candidate of candidates) {
    if (counted.has(candidate.phone)) {
      toQueue.push(candidate)
      continue
    }
    if (counted.size >= cap) {
      overCap.push(candidate)
      continue
    }
    counted.add(candidate.phone)
    toQueue.push(candidate)
  }

  return { toQueue, overCap }
}

/** Hebrew error naming the daily unique-recipient limit, for the queue summary/confirm dialog. */
export function dailyCapErrorMessage(cap: number = DAILY_RECIPIENT_CAP): string {
  return `לא ניתן לשלוח להם: הגעתם למגבלה של ${cap} נמענים ייחודיים בוואטסאפ בתוך 24 שעות`
}

export type LinkPhoneDecision =
  | { status: 'allowed' }
  | { status: 'requiresReplaceConfirmation'; existingPhone: string }

/**
 * Decides whether an inbound WhatsApp phone can be written onto a guest.
 * A guest with no phone, or the same phone (compared via the normalised
 * last-9-digits key), is a safe write. A guest with a *different* phone
 * needs explicit confirmation before overwriting it, since the phone may be
 * shared family contact info rather than a typo.
 */
export function decideLinkPhoneToGuest(
  guestPhone: string | null,
  inboundPhone: string,
  replacePhone: boolean
): LinkPhoneDecision {
  if (!guestPhone) return { status: 'allowed' }

  const existingKey = normalisePhone(guestPhone)
  const inboundKey = normalisePhone(inboundPhone)
  if (existingKey !== null && existingKey === inboundKey) return { status: 'allowed' }

  if (replacePhone) return { status: 'allowed' }

  return { status: 'requiresReplaceConfirmation', existingPhone: guestPhone }
}

export type HouseholdCandidate = {
  householdId: string
}

export type SkipAllocation<T> = {
  toSend: T[]
  skipped: T[]
}

/**
 * Splits candidates into those to send and those to skip because the
 * household was already messaged with this kind+template, unless the caller
 * explicitly asked for a resend.
 */
export function partitionAlreadyMessaged<T extends HouseholdCandidate>(
  candidates: readonly T[],
  alreadyMessagedHouseholdIds: ReadonlySet<string>,
  resend: boolean
): SkipAllocation<T> {
  if (resend) {
    return { toSend: [...candidates], skipped: [] }
  }

  const toSend: T[] = []
  const skipped: T[] = []
  for (const candidate of candidates) {
    if (alreadyMessagedHouseholdIds.has(candidate.householdId)) {
      skipped.push(candidate)
    } else {
      toSend.push(candidate)
    }
  }
  return { toSend, skipped }
}
