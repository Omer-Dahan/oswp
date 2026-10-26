import { render, screen } from '@testing-library/react'
import { createElement } from 'react'

import WeddingWebsite from '~/components/website/wedding'

const mockResolveTemplate = jest.fn()

// PersonalizedWelcome is an async server component with its own suite; a sync
// stand-in keeps this test focused on whether the home renders the banner.
jest.mock('~/components/website/personalized-welcome', () => ({
  PersonalizedWelcome: ({
    invitedHousehold,
  }: {
    invitedHousehold: { primaryContactGreeting: { name: string } | null }
  }) =>
    createElement(
      'aside',
      { 'aria-label': 'ברכת שלום אישית' },
      `שלום ${invitedHousehold.primaryContactGreeting?.name ?? ''}`
    ),
}))

jest.mock('~/templates', () => ({
  __esModule: true,
  TemplateThemeProvider: ({ children }: { children: React.ReactNode }) =>
    createElement('div', { 'data-testid': 'template-root' }, children),
  resolveTemplate: (templateId: string | null | undefined) => mockResolveTemplate(templateId),
}))

const createWeddingData = (overrides: Record<string, unknown> = {}) => ({
  groomFirstName: 'Shrek',
  groomLastName: 'Ogre',
  brideFirstName: 'Fiona',
  brideLastName: 'Ogre',
  daysRemaining: 0,
  date: {
    standardFormat: 'Tomorrow',
    numberFormat: '2026-04-25',
  },
  events: [],
  website: {
    id: 'website-1',
    weddingId: 'wedding-1',
    subUrl: 'shrek-and-fiona',
    templateId: 'aurelia',
    isPasswordEnabled: false,
    isRsvpEnabled: true,
    coverPhotoUrl: null,
    introText: '',
  },
  websiteBuilderEnabled: false,
  ...overrides,
})

describe('WeddingWebsite', () => {
  beforeEach(() => {
    mockResolveTemplate.mockReset()
    mockResolveTemplate.mockImplementation((id: string | null | undefined) => ({
      id: id ?? 'classic',
    }))
  })

  it('resolves the template from the stored templateId', async () => {
    render(
      await WeddingWebsite({ websiteSubUrl: 'shrek-and-fiona', weddingData: createWeddingData() })
    )

    expect(mockResolveTemplate).toHaveBeenCalledWith('aurelia')
    expect(screen.getByTestId('template-root')).toBeInTheDocument()
  })

  it('links the RSVP pill to the site rsvp route when RSVP is enabled', async () => {
    render(
      await WeddingWebsite({ websiteSubUrl: 'shrek-and-fiona', weddingData: createWeddingData() })
    )

    const rsvpLinks = screen.getAllByRole('link', { name: 'אישור הגעה לאירוע' })
    expect(rsvpLinks.length).toBeGreaterThan(0)
    for (const link of rsvpLinks) {
      expect(link).toHaveAttribute('href', '/w/shrek-and-fiona/rsvp')
    }
  })

  it('hides the RSVP pill when RSVP is disabled', async () => {
    render(
      await WeddingWebsite({
        websiteSubUrl: 'shrek-and-fiona',
        weddingData: createWeddingData({
          website: { ...createWeddingData().website, isRsvpEnabled: false },
        }),
      })
    )

    expect(screen.queryByRole('link', { name: 'אישור הגעה לאירוע' })).not.toBeInTheDocument()
  })

  it('shows the neutral greeting when no household is recognized', async () => {
    render(
      await WeddingWebsite({ websiteSubUrl: 'shrek-and-fiona', weddingData: createWeddingData() })
    )

    expect(screen.getAllByText('נשמח לראותכם').length).toBeGreaterThan(0)
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('greets a recognized household in the banner and the hero', async () => {
    render(
      await WeddingWebsite({
        websiteSubUrl: 'shrek-and-fiona',
        weddingData: createWeddingData({ websiteBuilderEnabled: true }),
        invitedHousehold: {
          guestFirstNames: ['Donkey', 'Dragon'],
          greeting: 'Donkey & Dragon',
          primaryContactGreeting: { name: 'Donkey', kind: 'firstName' },
        },
      })
    )

    expect(screen.getByRole('complementary', { name: 'ברכת שלום אישית' })).toHaveTextContent(
      'שלום Donkey'
    )
    expect(screen.getAllByText('שלום Donkey, נשמח לראותכם ביום שלנו 🤍').length).toBeGreaterThan(0)
  })
})
