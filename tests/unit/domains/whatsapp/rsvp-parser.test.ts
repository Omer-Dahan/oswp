/**
 * Tests for WhatsApp Domain RSVP Intent Parser
 */

import { parseRsvpReply } from '~/server/domains/whatsapp/rsvp-parser'

describe('parseRsvpReply', () => {
  it('recognises attending replies', () => {
    expect(parseRsvpReply('כן')).toEqual({ intent: 'attending', headcount: null, confidence: 'high' })
    expect(parseRsvpReply('אנחנו מגיעים בשמחה')).toEqual({
      intent: 'attending',
      headcount: null,
      confidence: 'high',
    })
    expect(parseRsvpReply('yes we confirm')).toEqual({
      intent: 'attending',
      headcount: null,
      confidence: 'high',
    })
  })

  it('recognises declined replies', () => {
    expect(parseRsvpReply('לא נוכל להגיע')).toEqual({
      intent: 'declined',
      headcount: null,
      confidence: 'high',
    })
    expect(parseRsvpReply('לצערי לא')).toEqual({ intent: 'declined', headcount: null, confidence: 'high' })
    expect(parseRsvpReply('decline, sorry')).toEqual({
      intent: 'declined',
      headcount: null,
      confidence: 'high',
    })
  })

  it('extracts a numeric headcount only alongside an attending intent', () => {
    expect(parseRsvpReply('כן, אנחנו 3 אנשים')).toEqual({
      intent: 'attending',
      headcount: 3,
      confidence: 'high',
    })
    expect(parseRsvpReply('מגיעים, שלושה אנשים')).toEqual({
      intent: 'attending',
      headcount: 3,
      confidence: 'high',
    })
    // A bare number with no intent stays unknown - the review screen needs a human.
    expect(parseRsvpReply('3')).toEqual({ intent: 'unknown', headcount: null, confidence: 'low' })
  })

  it('does not match "לא" inside a longer word', () => {
    // "שלא" ("that not") contains the letters of "לא" but is a different word.
    expect(parseRsvpReply('שלא תשכחו את המתנה')).toEqual({
      intent: 'unknown',
      headcount: null,
      confidence: 'low',
    })
  })

  it('never throws on empty, whitespace-only, or emoji-only text', () => {
    expect(parseRsvpReply('')).toEqual({ intent: 'unknown', headcount: null, confidence: 'low' })
    expect(parseRsvpReply('   ')).toEqual({ intent: 'unknown', headcount: null, confidence: 'low' })
    expect(parseRsvpReply('🎉🎉')).toEqual({ intent: 'unknown', headcount: null, confidence: 'low' })
    expect(parseRsvpReply(null)).toEqual({ intent: 'unknown', headcount: null, confidence: 'low' })
  })

  it('lets negation win, with low confidence, when a declined phrase overlaps an attending word', () => {
    // "מגיע" alone is an attending word, but "לא מגיע" negates it.
    expect(parseRsvpReply('לא מגיע')).toEqual({ intent: 'declined', headcount: null, confidence: 'low' })
  })

  it('flags an ambiguous message (unrelated attending and declined tokens) as low confidence', () => {
    expect(parseRsvpReply('כן אבל גם לא בטוח')).toEqual({
      intent: 'unknown',
      headcount: null,
      confidence: 'low',
    })
  })
})
