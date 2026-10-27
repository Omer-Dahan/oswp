import { fireEvent, render, screen } from '@testing-library/react'
import { RsvpStepsSettingsCard } from '~/app/_components/settings/rsvp-steps-settings-card'

const mockMutate = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}))

jest.mock('~/trpc/react', () => ({
  api: {
    wedding: {
      updateRsvpSteps: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
    },
  },
}))

describe('RsvpStepsSettingsCard', () => {
  beforeEach(() => mockMutate.mockReset())

  it('lists the complete whitelist with ordering controls and the guest page count', () => {
    render(<RsvpStepsSettingsCard rsvpSteps={['children-count', 'dietary-notes']} />)

    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(3)
    expect(switches.map((control) => control.getAttribute('aria-label'))).toEqual([
      'הצגת מספר ילדים',
      'הצגת הערות תזונתיות',
      'הצגת ברכה לזוג',
    ])

    for (const label of ['מספר ילדים', 'הערות תזונתיות', 'ברכה לזוג']) {
      expect(screen.getByRole('button', { name: `העלאת ${label}` })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: `הורדת ${label}` })).toBeInTheDocument()
    }

    expect(screen.getByText('4 עמודים קבועים לאורח')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: 'הצגת הערות תזונתיות' }))
    expect(screen.getByText('3 עמודים קבועים לאורח')).toBeInTheDocument()
  })

  it('saves enabled steps in the displayed order', () => {
    render(<RsvpStepsSettingsCard rsvpSteps={['children-count', 'dietary-notes']} />)

    fireEvent.click(screen.getByRole('switch', { name: 'הצגת ברכה לזוג' }))
    fireEvent.click(screen.getByRole('button', { name: 'העלאת ברכה לזוג' }))
    fireEvent.click(screen.getByRole('button', { name: 'שמירת הזרימה' }))

    expect(mockMutate).toHaveBeenCalledWith({
      rsvpSteps: ['children-count', 'wishes-message', 'dietary-notes'],
    })
  })

  it('warns when the children count step is disabled', () => {
    render(<RsvpStepsSettingsCard rsvpSteps={['children-count']} />)

    fireEvent.click(screen.getByRole('switch', { name: 'הצגת מספר ילדים' }))

    expect(screen.getByRole('alert')).toHaveTextContent('ספירת מנות הילדים בדוח המטבח תהיה ריקה')
  })
})
