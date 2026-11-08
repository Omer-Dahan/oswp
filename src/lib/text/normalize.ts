/**
 * Shared text normalization for guest-facing data.
 *
 * Pure functions only (no Prisma import) so the same normalizer runs on
 * both the client (search UI) and the server (write paths) without pulling
 * in server-only dependencies.
 */

const ZERO_WIDTH_CHARS = /[​-‍﻿]/g
const NBSP = / /g
const INLINE_WHITESPACE_RUN = /[ \t]+/g

/**
 * Collapse stray whitespace within a single line: trims the ends, turns a
 * non-breaking space into a regular space, drops zero-width characters, and
 * folds any run of spaces/tabs into one space.
 */
export function collapseInlineWhitespace(value: string): string {
  return value
    .replace(ZERO_WIDTH_CHARS, '')
    .replace(NBSP, ' ')
    .replace(INLINE_WHITESPACE_RUN, ' ')
    .trim()
}

/**
 * Normalize a single-line person/place name (firstName, lastName, groupName, city).
 */
export function normalizePersonName(value: string): string {
  return collapseInlineWhitespace(value)
}

/**
 * Normalize free text that may span multiple lines (notes), collapsing
 * inline whitespace per line while preserving intentional `\n` paragraph
 * breaks.
 */
export function normalizeMultilineText(value: string): string {
  return value
    .split('\n')
    .map((line) => collapseInlineWhitespace(line))
    .join('\n')
}

/**
 * Normalize an email address for storage: trim + lowercase.
 */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Fold a string to a comparable search form: lowercased, with
 * apostrophes/quotes/geresh/gershayim dropped and hyphens/dashes treated as
 * spaces, whitespace collapsed and trimmed.
 */
export function forSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’"׳״]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Split a search query into normalized terms (see `forSearch`).
 */
export function forSearchTerms(value: string): string[] {
  return forSearch(value).split(' ').filter(Boolean)
}

/**
 * True when every term of `query` (normalized via `forSearchTerms`) occurs
 * somewhere in `haystack` (normalized via `forSearch`), in any order. An
 * empty query matches everything.
 */
export function matchesSearchTerms(haystack: string, query: string): boolean {
  const normalizedHaystack = forSearch(haystack)
  return forSearchTerms(query).every((term) => normalizedHaystack.includes(term))
}
