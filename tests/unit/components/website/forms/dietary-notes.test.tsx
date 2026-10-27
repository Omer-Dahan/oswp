import { fireEvent, render, screen } from '@testing-library/react'

import DietaryNotesForm from '~/components/website/forms/steps/dietary-notes'

const translations: Record<string, string> = {
  'common.continue': 'CONTINUE',
  'common.back': 'BACK',
  'rsvp.dietaryNotesTitle': 'DIETARY NOTES TITLE',
  'rsvp.dietaryNotesHelper': 'DIETARY NOTES HELPER',
}

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    translations[`${namespace}.${key}`] ?? key,
}))

const mockUpdateRsvpForm = jest.fn()
let mockFormState: { dietaryNotes?: string | null }

jest.mock('~/components/contexts/rsvp-form-context', () => ({
  useRsvpForm: () => mockFormState,
  useUpdateRsvpForm: () => mockUpdateRsvpForm,
}))

describe('DietaryNotesForm', () => {
  beforeEach(() => {
    mockUpdateRsvpForm.mockReset()
    mockFormState = {}
  })

  it('sends null when an existing note is cleared, so the kitchen report drops it', () => {
    mockFormState = { dietaryNotes: 'No nuts please' }
    render(<DietaryNotesForm goNext={jest.fn()} goBack={jest.fn()} />)

    const textarea = screen.getByLabelText('DIETARY NOTES HELPER')
    expect(textarea).toHaveValue('No nuts please')

    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }))

    expect(mockUpdateRsvpForm).toHaveBeenCalledWith({ dietaryNotes: null })
  })

  it('trims whitespace-only input down to null', () => {
    mockFormState = { dietaryNotes: 'No nuts please' }
    render(<DietaryNotesForm goNext={jest.fn()} goBack={jest.fn()} />)

    fireEvent.change(screen.getByLabelText('DIETARY NOTES HELPER'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }))

    expect(mockUpdateRsvpForm).toHaveBeenCalledWith({ dietaryNotes: null })
  })
})
