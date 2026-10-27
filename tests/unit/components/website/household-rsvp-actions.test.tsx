import { render, screen } from '@testing-library/react'

import { HouseholdRsvpActions } from '~/components/website/household-invite/household-rsvp-actions'

describe('HouseholdRsvpActions', () => {
  it('renders the wedding pill, the chuppah pill, and the decline action', () => {
    render(
      <HouseholdRsvpActions
        websiteSubUrl='the-wedding'
        weddingEvent={{ id: 'wedding-event', name: 'Wedding' }}
        chuppahEvent={{ id: 'chuppah-event', name: 'חופה' }}
      />
    )

    expect(screen.getByRole('button', { name: 'אישור הגעה לחתונה' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'רק לחופה' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'לצערי לא נוכל להגיע' })).toBeInTheDocument()
  })

  it('hides the chuppah pill when the wedding has only one event', () => {
    render(
      <HouseholdRsvpActions
        websiteSubUrl='the-wedding'
        weddingEvent={{ id: 'wedding-event', name: 'Wedding' }}
        chuppahEvent={null}
      />
    )

    expect(screen.getByRole('button', { name: 'אישור הגעה לחתונה' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'רק לחופה' })).not.toBeInTheDocument()
  })

  it('shows a confirmation message after a redirect back with an outcome', () => {
    render(
      <HouseholdRsvpActions
        websiteSubUrl='the-wedding'
        weddingEvent={{ id: 'wedding-event', name: 'Wedding' }}
        chuppahEvent={null}
        rsvpOutcome='declined'
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('תיעדנו שלא תוכלו להגיע')
  })
})
