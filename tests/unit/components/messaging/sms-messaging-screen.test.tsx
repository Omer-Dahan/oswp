import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SmsMessagingScreen } from '~/components/messaging/sms-messaging-screen'

type Side = 'חתן' | 'כלה' | null

function sideKey(side: Side) {
  return side ?? 'default'
}

const templates: Record<string, { body: string; signature: string }> = {
  default: { body: 'תבנית ברירת מחדל {שם} {קישור}', signature: '' },
  חתן: { body: 'תבנית צד חתן {שם} {קישור}', signature: 'דוד' },
  כלה: { body: 'תבנית צד כלה {שם} {קישור}', signature: 'מורשה' },
}

const setSmsTemplateMutateAsync = jest.fn(
  async (input: { side: Side; template: string | null; signature: string | null }) => {
    const key = sideKey(input.side)
    const fallback = templates[key] ?? { body: '', signature: '' }
    templates[key] = {
      body: input.template ?? fallback.body,
      signature: input.signature ?? '',
    }
    return templates[key]
  }
)

jest.mock('~/components/messaging/sms-sender-management', () => ({
  SmsSenderManagement: () => null,
}))

jest.mock('~/trpc/react', () => ({
  api: {
    useUtils: () => ({
      sms: {
        getSmsTemplate: { invalidate: jest.fn().mockResolvedValue(undefined) },
        listSmsRecipients: { invalidate: jest.fn().mockResolvedValue(undefined) },
      },
    }),
    sms: {
      listSmsRecipients: {
        useQuery: () => ({ data: [], isLoading: false, error: null }),
      },
      listSmsSenders: {
        useQuery: () => ({ data: [], isLoading: false, error: null }),
      },
      getSmsTemplate: {
        useQuery: (input: { side: Side }) => ({
          data: templates[sideKey(input.side)],
          isLoading: false,
          error: null,
        }),
      },
      setSmsTemplate: {
        useMutation: () => ({ mutateAsync: setSmsTemplateMutateAsync, isPending: false }),
      },
      sendSms: { useMutation: () => ({ mutateAsync: jest.fn(), isPending: false }) },
      sendSmsAgain: { useMutation: () => ({ mutateAsync: jest.fn(), isPending: false }) },
    },
  },
}))

describe('SmsMessagingScreen template editor', () => {
  beforeEach(() => {
    setSmsTemplateMutateAsync.mockClear()
    templates.default = { body: 'תבנית ברירת מחדל {שם} {קישור}', signature: '' }
    templates['חתן'] = { body: 'תבנית צד חתן {שם} {קישור}', signature: 'דוד' }
    templates['כלה'] = { body: 'תבנית צד כלה {שם} {קישור}', signature: 'מורשה' }
  })

  it('loads the default template with no signature line in the preview', () => {
    render(<SmsMessagingScreen />)

    expect(screen.getByLabelText('נוסח הודעת SMS')).toHaveValue('תבנית ברירת מחדל {שם} {קישור}')
    expect(screen.getByLabelText('חתימה')).toHaveValue('')
    expect(screen.getByText(/חתימה ריקה לא תוסיף שורת/)).toBeInTheDocument()
    expect(screen.getByText('תצוגה מקדימה לדוגמה').nextElementSibling).toHaveTextContent(
      'תבנית ברירת מחדל ישראל ישראלי https://wedding.example/inv/SAMPLE123'
    )
  })

  it('switches to a side and loads that side template and signature', () => {
    render(<SmsMessagingScreen />)

    fireEvent.click(screen.getByLabelText('בחירת צד לעריכת הנוסח'))
    fireEvent.click(screen.getByRole('option', { name: 'צד חתן' }))

    expect(screen.getByLabelText('נוסח הודעת SMS')).toHaveValue('תבנית צד חתן {שם} {קישור}')
    expect(screen.getByLabelText('חתימה')).toHaveValue('דוד')
    expect(screen.getByText(/בברכה - דוד/)).toBeInTheDocument()
  })

  it('saving one side does not clobber another side', async () => {
    render(<SmsMessagingScreen />)

    fireEvent.click(screen.getByLabelText('בחירת צד לעריכת הנוסח'))
    fireEvent.click(screen.getByRole('option', { name: 'צד חתן' }))

    fireEvent.change(screen.getByLabelText('נוסח הודעת SMS'), {
      target: { value: 'נוסח חתן מעודכן {שם} {קישור}' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'שמור נוסח' }))

    await waitFor(() =>
      expect(setSmsTemplateMutateAsync).toHaveBeenCalledWith({
        side: 'חתן',
        template: 'נוסח חתן מעודכן {שם} {קישור}',
        signature: 'דוד',
      })
    )

    expect(templates['כלה']).toEqual({ body: 'תבנית צד כלה {שם} {קישור}', signature: 'מורשה' })
    expect(templates.default).toEqual({ body: 'תבנית ברירת מחדל {שם} {קישור}', signature: '' })
  })
})
