import {
  buildWeddingInviteSms,
  formatSmsRecipientName,
  renderWeddingInviteSmsTemplate,
} from '~/lib/sms/invite-message'

describe('SMS wedding invite template', () => {
  it.each([
    'ואשתו',
    'ובעל',
    'ובעלו',
    'ומשפחת',
    'המשפחה',
    'ומשפחה',
  ])('drops filler surname %s', (lastName) => {
    expect(formatSmsRecipientName('ישראל', lastName)).toBe('ישראל')
  })

  it('removes the family prefix but keeps the surname', () => {
    expect(formatSmsRecipientName('משה', 'משפחת כהן')).toBe('משה כהן')
  })

  it.each([
    'דודה',
    'דוד',
    'סבא',
    'סבתא',
    'חמות',
    'חם',
    'אח',
    'אחות',
    'בן דוד',
    'בת דוד',
    'הגב',
    'מר',
    'גברת',
  ])('strips the relation or title prefix %s', (prefix) => {
    expect(formatSmsRecipientName(`${prefix} יעקב`, 'לוי')).toBe('יעקב לוי')
  })

  it('strips parenthesised notes from both names', () => {
    expect(formatSmsRecipientName('רחל (עבודה)', 'כהן (צפון)')).toBe('רחל כהן')
  })

  it('falls back to the cleaned first name', () => {
    expect(formatSmsRecipientName('מר יהודה', 'ואשתו')).toBe('יהודה')
  })

  it('renders the frozen message and household link exactly', () => {
    expect(
      buildWeddingInviteSms({ firstName: 'דוד יעקב', lastName: 'כהן', inviteCode: 'ab-123' })
    ).toBe(`יעקב כהן, שלום רב.
אנו שמחים להזמין אתכם לחתונה של דוד מנחם ומורשה בן הרוש, בתאריך י״ד כסלו (24.11.26) באולמי אגדתא. נשמח לאישור הגעה
https://david-and-morasha.duckdns.org/w/guests/save-the-date/ab-123

בברכה - יהודה ותמר מנחם`)
  })

  it('marks a household without an invite code as unrenderable', () => {
    expect(
      buildWeddingInviteSms({ firstName: 'יעקב', lastName: 'כהן', inviteCode: null })
    ).toBeNull()
  })

  it('substitutes the recipient name and invite link', () => {
    expect(
      renderWeddingInviteSmsTemplate({
        template: 'שלום {שם}\nהזמנה: {קישור}',
        recipientName: 'יעקב כהן',
        inviteLink: 'https://example.com/invite',
      })
    ).toBe('שלום יעקב כהן\nהזמנה: https://example.com/invite')
  })

  it('keeps templates without placeholders verbatim', () => {
    expect(
      renderWeddingInviteSmsTemplate({
        template: 'הודעה קבועה ללא שדות',
        recipientName: 'יעקב כהן',
        inviteLink: 'https://example.com/invite',
      })
    ).toBe('הודעה קבועה ללא שדות')
  })

  it.each([null, '', '   '])('falls back to the default for %p', (template) => {
    expect(
      renderWeddingInviteSmsTemplate({
        template,
        recipientName: 'יעקב כהן',
        inviteLink: 'https://example.com/invite',
      })
    ).toContain('יעקב כהן, שלום רב.')
  })

  it('preserves Hebrew and Unicode text', () => {
    expect(
      renderWeddingInviteSmsTemplate({
        template: 'משפחת {שם} 💛\n{קישור}',
        recipientName: 'לוי',
        inviteLink: 'קישור-אישי',
      })
    ).toBe('משפחת לוי 💛\nקישור-אישי')
  })
})
