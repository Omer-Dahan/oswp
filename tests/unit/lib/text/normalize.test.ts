import {
  collapseInlineWhitespace,
  forSearch,
  forSearchTerms,
  matchesSearchTerms,
  normalizeEmail,
  normalizeMultilineText,
  normalizePersonName,
} from '~/lib/text/normalize'

describe('collapseInlineWhitespace', () => {
  it('trims a trailing space', () => {
    expect(collapseInlineWhitespace('אבירן ')).toBe('אבירן')
  })

  it('collapses a double space to one', () => {
    expect(collapseInlineWhitespace('אבירן  צומו')).toBe('אבירן צומו')
  })

  it('replaces a non-breaking space with a regular space', () => {
    expect(collapseInlineWhitespace('אבירן צומו')).toBe('אבירן צומו')
  })

  it('strips zero-width characters', () => {
    expect(collapseInlineWhitespace('אבי​רן‌‍﻿')).toBe('אבירן')
  })
})

describe('normalizePersonName', () => {
  it('collapses whitespace on a single line', () => {
    expect(normalizePersonName('  John   Doe  ')).toBe('John Doe')
  })
})

describe('normalizeMultilineText', () => {
  it('collapses inline whitespace per line while preserving line breaks', () => {
    const input = 'Line one  with  spaces \n\nLine two   '
    expect(normalizeMultilineText(input)).toBe('Line one with spaces\n\nLine two')
  })
})

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  John.Doe@Example.com  ')).toBe('john.doe@example.com')
  })
})

describe('forSearch / forSearchTerms', () => {
  it('lowercases, strips quotes, folds hyphens, and collapses whitespace', () => {
    expect(forSearch(`O'Brien-Smith  `)).toBe('obrien smith')
  })

  it('splits into normalized terms', () => {
    expect(forSearchTerms('  אבירן   צומו  ')).toEqual(['אבירן', 'צומו'])
  })
})

describe('matchesSearchTerms', () => {
  // Real prod row (id 1348): firstName stored with a trailing space.
  const haystack = `${'אבירן '} ${'צומו'}`

  it('matches when the query terms are in the stored order', () => {
    expect(matchesSearchTerms(haystack, 'אבירן צומו')).toBe(true)
  })

  it('matches when the query terms are reversed', () => {
    expect(matchesSearchTerms(haystack, 'צומו אבירן')).toBe(true)
  })

  it('matches a single term', () => {
    expect(matchesSearchTerms(haystack, 'צומו')).toBe(true)
  })

  it('tolerates extra whitespace in the query', () => {
    expect(matchesSearchTerms(haystack, '  אבירן   צומו  ')).toBe(true)
  })

  it('does not match an unrelated term', () => {
    expect(matchesSearchTerms(haystack, 'הרץ')).toBe(false)
  })

  it('matches everything for an empty query', () => {
    expect(matchesSearchTerms(haystack, '')).toBe(true)
  })
})
