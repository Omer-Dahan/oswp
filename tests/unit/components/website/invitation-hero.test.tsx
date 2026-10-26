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
  it('renders a wedding pill and a chuppah pill, neither preselecting an event', () => {
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
    const chuppahLinks = screen.getAllByRole('link', { name: 'אישור הגעה לחופה' })

    expect(weddingLinks.length).toBeGreaterThan(0)
    expect(chuppahLinks.length).toBeGreaterThan(0)
    // A household invited to more than one RSVP-able event is never
    // preselected into either one — an event-scoped submission would
    // silently drop the other event's answers (see RsvpPills in
    // invitation-hero.tsx) — so both pills link to the plain RSVP form.
    for (const link of [...weddingLinks, ...chuppahLinks]) {
      expect(link).toHaveAttribute('href', '/w/the-wedding/rsvp')
    }
  })

  it('renders only the wedding pill when the wedding has a single event', () => {
    render(
      <InvitationHero
        {...baseProps}
        events={[{ id: 'only-event', name: 'Wedding', isPrimary: true }]}
      />
    )

    expect(screen.getAllByRole('link', { name: 'אישור הגעה לחתונה' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'אישור הגעה לחופה' })).not.toBeInTheDocument()
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
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/w/the-wedding/rsvp')
    }
  })
})
