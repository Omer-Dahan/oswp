import { fireEvent, render, screen, within } from '@testing-library/react'
import { RsvpCopyEditor } from '~/app/(authenicated)/events/_components/rsvp-copy-editor'
import { getDefaultRsvpCopy, type RsvpCopyOverrides } from '~/lib/rsvp/copy'

const mockMutate = jest.fn()
const mockSetData = jest.fn()
const mockToastSuccess = jest.fn()
let mockOnSuccess: ((copy: RsvpCopyOverrides) => void) | undefined
let mockCopy: RsvpCopyOverrides = {}

jest.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => mockToastSuccess(...args), error: jest.fn() },
}))

jest.mock('~/trpc/react', () => ({
  api: {
    useUtils: () => ({
      wedding: { getRsvpCopy: { setData: (...args: unknown[]) => mockSetData(...args) } },
    }),
    wedding: {
      getRsvpCopy: {
        useQuery: () => ({ data: mockCopy, isLoading: false, error: null }),
      },
      updateRsvpCopy: {
        useMutation: (options: { onSuccess: (copy: RsvpCopyOverrides) => void }) => {
          mockOnSuccess = options.onSuccess
          return {
            mutate: (...args: unknown[]) => mockMutate(...args),
            isPending: false,
          }
        },
      },
    },
  },
}))

describe('RsvpCopyEditor', () => {
  beforeEach(() => {
    mockCopy = { whoIsComingTitle: 'מי חוגג איתנו?' }
    mockMutate.mockReset()
    mockSetData.mockReset()
    mockToastSuccess.mockReset()
    mockOnSuccess = undefined
  })

  it('resets one override and saves only the remaining changed keys', () => {
    render(<RsvpCopyEditor open />)
    const textarea = screen.getByLabelText('כותרת מי מגיע')
    const field = textarea.closest('div.rounded-md')
    if (!field) throw new Error('Expected RSVP copy field container')

    expect(textarea).toHaveValue('מי חוגג איתנו?')
    expect(within(field).getByText(/ברירת מחדל:/)).toHaveTextContent(
      getDefaultRsvpCopy('whoIsComingTitle')
    )

    fireEvent.click(within(field).getByRole('button', { name: 'איפוס לברירת מחדל' }))
    expect(textarea).toHaveValue(getDefaultRsvpCopy('whoIsComingTitle'))
    fireEvent.click(screen.getByRole('button', { name: 'שמירת נוסחים' }))

    expect(mockMutate).toHaveBeenCalledWith({ rsvpCopy: {} })
  })

  it('keeps line breaks in an edited value and resets the whole set', () => {
    render(<RsvpCopyEditor open />)
    const textarea = screen.getByLabelText('כותרת מי מגיע')

    fireEvent.change(textarea, { target: { value: 'מי מגיע\nלחגוג איתנו?' } })
    fireEvent.click(screen.getByRole('button', { name: 'שמירת נוסחים' }))
    expect(mockMutate).toHaveBeenLastCalledWith({
      rsvpCopy: { whoIsComingTitle: 'מי מגיע\nלחגוג איתנו?' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'איפוס הכול' }))
    fireEvent.click(screen.getByRole('button', { name: 'שמירת נוסחים' }))
    expect(mockMutate).toHaveBeenLastCalledWith({ rsvpCopy: {} })
  })

  it('updates cached copy and shows a success toast after save', () => {
    render(<RsvpCopyEditor open />)

    mockOnSuccess?.({ childrenCountTitle: 'כמה ילדים איתכם?' })

    expect(mockSetData).toHaveBeenCalledWith(undefined, {
      childrenCountTitle: 'כמה ילדים איתכם?',
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('נוסחי אישור ההגעה נשמרו')
  })
})
