import { render, screen } from '@testing-library/react'

import { InvitationHero } from '~/components/website/invitation-hero'

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  )
  return MockLink
})

jest.mock('next/image', () => {
  const MockImage = ({ alt }: { alt: string }) => <img alt={alt} />
  return MockImage
})

const baseProps = {
  rsvpHref: '/w/the-wedding/rsvp',
  isRsvpEnabled: true,
  coupleNames: 'דוד ומורן',
  invitedHousehold: null,
}

describe('InvitationHero', () => {
  it('renders the full contact name and invitation subtitle in both compositions', () => {
    render(
      <InvitationHero
        {...baseProps}
        invitedHousehold={{
          guestFirstNames: ['נועה'],
          greeting: 'עומר דהן',
          primaryContactGreeting: { name: 'עומר דהן', kind: 'fullName' },
        }}
        events={[]}
      />
    )

    expect(screen.getAllByRole('heading', { name: 'שלום עומר דהן' })).toHaveLength(2)
    expect(screen.getAllByText('נשמח לדעת אם תגיעו')).toHaveLength(2)
    expect(screen.queryByText(/משפחת/)).not.toBeInTheDocument()
  })

  it('renders a single contact without a family prefix', () => {
    render(
      <InvitationHero
        {...baseProps}
        invitedHousehold={{
          guestFirstNames: ['נועה'],
          greeting: 'נועה',
          primaryContactGreeting: { name: 'עומר', kind: 'fullName' },
        }}
        events={[]}
      />
    )

    expect(screen.getAllByRole('heading', { name: 'שלום עומר' })).toHaveLength(2)
    expect(screen.queryByText(/משפחת/)).not.toBeInTheDocument()
  })

  it('does not render the greeting without a primary contact', () => {
    const { rerender } = render(<InvitationHero {...baseProps} events={[]} />)

    expect(screen.queryByText('נשמח לדעת אם תגיעו')).not.toBeInTheDocument()

    rerender(
      <InvitationHero
        {...baseProps}
        invitedHousehold={{ guestFirstNames: [], greeting: null, primaryContactGreeting: null }}
        events={[]}
      />
    )

    expect(screen.queryByText('נשמח לדעת אם תגיעו')).not.toBeInTheDocument()
  })

  it('renders a wedding pill and a chuppah pill, and only the chuppah preselects its event', () => {
    render(
      <InvitationHero
        {...baseProps}
        events={[
          { id: 'wedding-event', name: 'Wedding', isPrimary: true, collectRsvp: true },
          { id: 'chuppah-event', name: 'חופה', isPrimary: false, collectRsvp: true },
        ]}
      />
    )

    const weddingLinks = screen.getAllByRole('link', { name: 'אישור הגעה לחתונה' })
    const chuppahLinks = screen.getAllByRole('link', { name: 'רק לחופה' })

    expect(weddingLinks.length).toBeGreaterThan(0)
    expect(chuppahLinks.length).toBeGreaterThan(0)
    // "רק לחופה" is a deliberately narrower answer, so it preselects the chuppah
    // and the form then drops the meal-only steps (children, dietary). The full
    // RSVP pill stays unscoped so it keeps covering every event.
    for (const link of weddingLinks) {
      expect(link).toHaveAttribute('href', '/w/the-wedding/rsvp')
    }
    for (const link of chuppahLinks) {
      expect(link).toHaveAttribute('href', '/w/the-wedding/rsvp?event=chuppah-event')
    }
  })

  it('preselects the single RSVP-able event when the household is also invited to a non-collectRsvp event', () => {
    // e.g. the auto-created, non-collectRsvp "חופה וקידושין" ceremony event
    // alongside the RSVP-collecting reception — only one event actually
    // collects RSVPs, so it's safe to preselect it (see hasMultipleRsvpableEvents
    // in invitation-hero.tsx, which counts only collectRsvp events).
    render(
      <InvitationHero
        {...baseProps}
        events={[
          { id: 'reception-event', name: 'קבלת פנים', isPrimary: true, collectRsvp: true },
          { id: 'chuppah-event', name: 'חופה וקידושין', isPrimary: false, collectRsvp: false },
        ]}
      />
    )

    const weddingLinks = screen.getAllByRole('link', { name: 'אישור הגעה לחתונה' })
    expect(weddingLinks.length).toBeGreaterThan(0)
    for (const link of weddingLinks) {
      expect(link).toHaveAttribute('href', '/w/the-wedding/rsvp?event=reception-event')
    }
    expect(screen.queryByRole('link', { name: 'רק לחופה' })).not.toBeInTheDocument()
  })

  it('renders only the wedding pill when the wedding has a single event', () => {
    render(
      <InvitationHero
        {...baseProps}
        events={[{ id: 'only-event', name: 'Wedding', isPrimary: true }]}
      />
    )

    expect(screen.getAllByRole('link', { name: 'אישור הגעה לחתונה' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'רק לחופה' })).not.toBeInTheDocument()
  })

  it('does not render the copy-link action', () => {
    render(
      <InvitationHero
        {...baseProps}
        invitedHousehold={{
          guestFirstNames: ['דוד'],
          greeting: 'דוד',
          primaryContactGreeting: { name: 'דוד', kind: 'fullName' },
        }}
        events={[{ id: 'only-event', name: 'Wedding', isPrimary: true, collectRsvp: true }]}
      />
    )

    expect(screen.queryByText('העתקת קישור')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /העתקת קישור/ })).not.toBeInTheDocument()
  })

  it('styles the decline action like the chuppah pill and keeps its RSVP link', () => {
    render(
      <InvitationHero
        {...baseProps}
        events={[
          { id: 'wedding-event', name: 'Wedding', isPrimary: true, collectRsvp: true },
          { id: 'chuppah-event', name: 'חופה', isPrimary: false, collectRsvp: true },
        ]}
      />
    )

    const declineLinks = screen.getAllByRole('link', { name: 'לצערינו לא מתאפשר' })
    const chuppahLinks = screen.getAllByRole('link', { name: 'רק לחופה' })
    expect(declineLinks).toHaveLength(chuppahLinks.length)
    // Decline is a confirmation flow, not a one-click action (see
    // src/app/w/[websiteSubUrl]/rsvp/page.tsx), so the link carries ?decline=1.
    for (const [index, link] of declineLinks.entries()) {
      expect(link).toHaveAttribute('href', '/w/the-wedding/rsvp?decline=1')
      expect(link.className).toBe(chuppahLinks[index]?.className)
    }
  })
})
