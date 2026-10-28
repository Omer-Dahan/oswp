import { render, screen } from '@testing-library/react'

import type { InvitedHousehold } from '~/app/w/[websiteSubUrl]/_lib/invited-household'
import { PersonalizedWelcome } from '~/components/website/personalized-welcome'

const inviteTranslations: Record<string, string> = {
  householdGreetingFamily: 'שלום משפחת {name}',
  householdGreetingFirstName: 'שלום {name}',
  personalizedWelcomeAriaLabel: 'ברכת שלום אישית',
}

jest.mock('next-intl/server', () => ({
  getTranslations: () =>
    Promise.resolve((key: string, params?: Record<string, string | number>) => {
      const template = inviteTranslations[key] ?? key
      if (!params) return template
      return Object.entries(params).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
        template
      )
    }),
}))

function buildInvitedHousehold(
  overrides: Partial<InvitedHousehold>
): InvitedHousehold {
  return {
    guestFirstNames: ['Alice'],
    greeting: 'Alice',
    primaryContactGreeting: null,
    ...overrides,
  }
}

describe('PersonalizedWelcome', () => {
  it('greets a contact by full name without throwing', async () => {
    const invitedHousehold = buildInvitedHousehold({
      primaryContactGreeting: { name: 'עומר דהן', kind: 'fullName' },
    })

    render(await PersonalizedWelcome({ invitedHousehold }))

    expect(screen.getByText('שלום עומר דהן')).toBeInTheDocument()
    expect(screen.queryByText(/משפחת/)).not.toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'ברכת שלום אישית' })).toBeInTheDocument()
  })

  it('greets a single guest by first name without throwing', async () => {
    const invitedHousehold = buildInvitedHousehold({
      primaryContactGreeting: { name: 'אלון', kind: 'fullName' },
    })

    render(await PersonalizedWelcome({ invitedHousehold }))

    expect(screen.getByText('שלום אלון')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'ברכת שלום אישית' })).toBeInTheDocument()
  })
})
