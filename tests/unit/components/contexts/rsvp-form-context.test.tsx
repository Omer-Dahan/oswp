import { render, screen } from '@testing-library/react'

import { RsvpFormProvider, useRsvpForm } from '~/components/contexts/rsvp-form-context'

function HouseholdProbe() {
  const state = useRsvpForm()

  return <span>{state.selectedHousehold?.guests[0]?.firstName ?? 'missing household'}</span>
}

describe('RsvpFormProvider', () => {
  it('selects a household recognized from a personal invite link', () => {
    const recognizedHousehold = {
      id: 'household-1',
      invitedCount: 2,
      attendingCount: null,
      childrenCount: null,
      dietaryNotes: null,
      wishesMessage: null,
      guests: [
        {
          id: 1,
          firstName: 'דוד',
          lastName: 'כהן',
          isPrimaryContact: true,
          isTagAlong: false,
          ageGroup: 'ADULT' as const,
          invitations: [{ id: 'invite-1', eventId: 'event-1', rsvp: 'Invited' }],
        },
      ],
    }

    render(
      <RsvpFormProvider recognizedHousehold={recognizedHousehold}>
        <HouseholdProbe />
      </RsvpFormProvider>
    )

    expect(screen.getByText('דוד')).toBeInTheDocument()
  })
})
