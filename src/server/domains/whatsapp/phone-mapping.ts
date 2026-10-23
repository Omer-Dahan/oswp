/**
 * WhatsApp Domain - Phone Normalisation
 *
 * Builds a comparable match key from a raw phone number so inbound WhatsApp
 * senders (E.164-ish, with or without a leading +/00) can be matched against
 * however a guest's phone happens to be stored in the guest list.
 */

/**
 * Strips everything but digits, then keeps the last 9 digits as the match
 * key. The last 9 significant digits are stable across the Israeli phone
 * spellings this app sees (+972, 00972, leading 0, with/without dashes or
 * spaces), since every variant only differs in how the leading trunk/country
 * prefix is written. Returns null when there aren't enough digits to match on.
 */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 9) return null
  return digits.slice(-9)
}
