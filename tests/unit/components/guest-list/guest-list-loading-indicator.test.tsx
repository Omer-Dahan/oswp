import { act, render, screen } from '@testing-library/react'
import { GuestListLoadingIndicator } from '~/components/guest-list/guest-list-loading-indicator'

describe('GuestListLoadingIndicator', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('waits before showing the first-load label and disappears on settle', () => {
    const { rerender } = render(<GuestListLoadingIndicator loading />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    act(() => jest.advanceTimersByTime(250))
    expect(screen.getByRole('status', { name: 'טוען' })).toHaveTextContent('טוען…')

    rerender(<GuestListLoadingIndicator loading={false} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows only the spinner during a refetch', () => {
    render(<GuestListLoadingIndicator loading refetching />)
    act(() => jest.advanceTimersByTime(250))

    expect(screen.getByRole('status', { name: 'טוען מחדש' })).not.toHaveTextContent('טוען…')
  })
})
