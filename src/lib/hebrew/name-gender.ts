import namesData from './names.json'

// names.json is CBS-derived Hebrew first-name gender data, copied verbatim
// from birthly-go (internal/core/names.json). MIT-licensed own data, no
// runtime network access.

type NameLists = {
  m: string[]
  f: string[]
  unisex: string[]
}

const { m: mList, f: fList, unisex: unisexList } = namesData as NameLists

const NIKUD_AND_QUOTES = /[֑-ׇ"'׳״]/g

const SOFIT_MAP: Record<string, string> = {
  ך: 'כ',
  ם: 'מ',
  ן: 'נ',
  ף: 'פ',
  ץ: 'צ',
}

const normalizeSofit = (s: string): string =>
  s.replace(/[ךםןףץ]/g, (c) => SOFIT_MAP[c] ?? c)

// Both the query and the table are normalised to the same sofit-folded form
// before comparing - a few table entries are stored without their final
// sofit letter (data quirks in the source list), and folding only the query
// would otherwise break every correctly-spelled name that ends in one.
const normalizedMList = mList.map(normalizeSofit)
const normalizedFList = fList.map(normalizeSofit)
const normalizedUnisexList = unisexList.map(normalizeSofit)

const mSet = new Set(normalizedMList)
const fSet = new Set(normalizedFList)
const unisexSet = new Set(normalizedUnisexList)

const existsInTables = (s: string): boolean => {
  const key = normalizeSofit(s)
  return mSet.has(key) || fSet.has(key) || unisexSet.has(key)
}

const firstToken = (rawName: string): string | null => {
  const token = rawName.trim().split(/\s+/)[0]
  return token && token.length > 0 ? token : null
}

const cleanToken = (token: string): string => {
  let cleaned = token.replace(NIKUD_AND_QUOTES, '')
  if (cleaned.length > 1 && cleaned[0] === 'ה' && existsInTables(cleaned.slice(1))) {
    cleaned = cleaned.slice(1)
  }
  return cleaned
}

/**
 * Ratcliff/Obershelp similarity ratio between a and b (2*M / T), ported from
 * Python's difflib.SequenceMatcher to match the birthday bot's fuzzy
 * matcher exactly. Not symmetric in tie-breaking, so argument order matters
 * at the call site (see closestMatch).
 */
const sequenceRatio = (a: string[], b: string[]): number => {
  const total = a.length + b.length
  if (total === 0) return 1
  const b2j = new Map<string, number[]>()
  for (let j = 0; j < b.length; j++) {
    const arr = b2j.get(b[j]!)
    if (arr) arr.push(j)
    else b2j.set(b[j]!, [j])
  }
  const matches = sumMatchingBlocks(a, b, b2j, 0, a.length, 0, b.length)
  return (2 * matches) / total
}

const findLongestMatch = (
  a: string[],
  b: string[],
  b2j: Map<string, number[]>,
  alo: number,
  ahi: number,
  blo: number,
  bhi: number
): [number, number, number] => {
  let besti = alo
  let bestj = blo
  let bestsize = 0
  let j2len = new Map<number, number>()
  for (let i = alo; i < ahi; i++) {
    const newj2len = new Map<number, number>()
    const candidates = b2j.get(a[i]!) ?? []
    for (const j of candidates) {
      if (j < blo) continue
      if (j >= bhi) break
      const k = (j2len.get(j - 1) ?? 0) + 1
      newj2len.set(j, k)
      if (k > bestsize) {
        besti = i - k + 1
        bestj = j - k + 1
        bestsize = k
      }
    }
    j2len = newj2len
  }

  while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
    besti--
    bestj--
    bestsize++
  }
  while (
    besti + bestsize < ahi &&
    bestj + bestsize < bhi &&
    a[besti + bestsize] === b[bestj + bestsize]
  ) {
    bestsize++
  }

  return [besti, bestj, bestsize]
}

const sumMatchingBlocks = (
  a: string[],
  b: string[],
  b2j: Map<string, number[]>,
  alo: number,
  ahi: number,
  blo: number,
  bhi: number
): number => {
  const [besti, bestj, bestsize] = findLongestMatch(a, b, b2j, alo, ahi, blo, bhi)
  if (bestsize === 0) return 0
  let total = bestsize
  if (alo < besti && blo < bestj) {
    total += sumMatchingBlocks(a, b, b2j, alo, besti, blo, bestj)
  }
  if (besti + bestsize < ahi && bestj + bestsize < bhi) {
    total += sumMatchingBlocks(a, b, b2j, besti + bestsize, ahi, bestj + bestsize, bhi)
  }
  return total
}

/**
 * Ports Python's difflib.get_close_matches(word, possibilities, n=1, cutoff).
 * Argument order to sequenceRatio is (candidate, word) to match Python's
 * SequenceMatcher(a=candidate, b=word) exactly, since ratio() isn't
 * perfectly symmetric in its tie-breaking. Ties break on the
 * lexicographically greatest candidate, mirroring heapq.nlargest.
 */
const closestMatch = (word: string, possibilities: string[], cutoff: number): boolean => {
  const wordRunes = Array.from(word)
  let bestRatio = -1
  let best = ''
  let found = false
  for (const candidate of possibilities) {
    const r = sequenceRatio(Array.from(candidate), wordRunes)
    if (r < cutoff) continue
    if (r > bestRatio || (r === bestRatio && candidate > best)) {
      bestRatio = r
      best = candidate
      found = true
    }
  }
  return found
}

export type NameGender = 'male' | 'female' | 'unisex' | 'unknown'

/**
 * Resolves the gender of a guest from their first name using the
 * CBS-derived name table, falling back to the same fuzzy matcher as the
 * birthday bot (Ratcliff/Obershelp, cutoff 0.85) for misspellings. Never
 * guesses from suffixes - an unresolved name returns 'unknown' rather than
 * a guess.
 */
export const detectNameGender = (rawName: string): NameGender => {
  const token = firstToken(rawName)
  if (!token) return 'unknown'

  const cleaned = cleanToken(token)
  const lookupKey = normalizeSofit(cleaned)

  if (unisexSet.has(lookupKey)) return 'unisex'
  if (mSet.has(lookupKey)) return 'male'
  if (fSet.has(lookupKey)) return 'female'

  if (Array.from(lookupKey).length > 2) {
    const mOk = closestMatch(lookupKey, normalizedMList, 0.85)
    const fOk = closestMatch(lookupKey, normalizedFList, 0.85)
    if (mOk && !fOk) return 'male'
    if (fOk && !mOk) return 'female'
  }

  return 'unknown'
}

export type AddressFormHousehold = {
  guestCount: number
  confirmedCount?: number | null
  primaryGuestFirstName?: string | null
}

export type AddressForm = 'plural' | 'male' | 'female' | 'neutral'

/**
 * The wording a guest-facing message should use: plural for a household of
 * more than one, otherwise the gender of the single named guest - and
 * neutral when that gender can't be resolved, so the copy never guesses.
 */
export const getAddressForm = (household: AddressFormHousehold): AddressForm => {
  const { guestCount, confirmedCount, primaryGuestFirstName } = household

  if (guestCount > 1 || (confirmedCount != null && confirmedCount > 1)) {
    return 'plural'
  }

  const gender = detectNameGender(primaryGuestFirstName ?? '')
  if (gender === 'male') return 'male'
  if (gender === 'female') return 'female'
  return 'neutral'
}
