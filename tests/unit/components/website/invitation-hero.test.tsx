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
  websiteSubUrl: 'the-wedding',
  rsvpHref: '/w/the-wedding/rsvp',
  isRsvpEnabled: true,
  coupleNames: 'דוד ומורן',
  invitedHousehold: null,
  householdInviteCode: null,
}

describe('InvitationHero', () => {
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

  it('does not render the copy-link action when no household is resolved', () => {
    render(
      <InvitationHero
        {...baseProps}
        events={[{ id: 'only-event', name: 'Wedding', isPrimary: true }]}
      />
    )

    expect(screen.queryByText('העתקת קישור')).not.toBeInTheDocument()
  })

  it('renders the copy-link action when a household is resolved', () => {
    render(
      <InvitationHero
        {...baseProps}
        householdInviteCode='hh-abc123'
        invitedHousehold={{
          guestFirstNames: ['דוד'],
          greeting: 'דוד',
          primaryContactGreeting: { name: 'דוד', kind: 'firstName' },
        }}
        events={[{ id: 'only-event', name: 'Wedding', isPrimary: true }]}
      />
    )

    expect(screen.getAllByText('העתקת קישור').length).toBeGreaterThan(0)
  })

  it('links the decline action to the RSVP form when no household is resolved', () => {
    render(
      <InvitationHero
        {...baseProps}
        events={[{ id: 'only-event', name: 'Wedding', isPrimary: true }]}
      />
    )

    const links = screen.getAllByRole('link', { name: 'לצערינו לא מתאפשר' })
    expect(links.length).toBeGreaterThan(0)
    // Decline is a confirmation flow, not a one-click action (see
    // src/app/w/[websiteSubUrl]/rsvp/page.tsx), so the link carries ?decline=1.
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/w/the-wedding/rsvp?decline=1')
    }
  })
})
