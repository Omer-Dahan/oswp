import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { SeatingAutoSeatDialog } from '~/components/seating-chart/seating-auto-seat-dialog'

const renderDialog = (overrides: Partial<Parameters<typeof SeatingAutoSeatDialog>[0]> = {}) => {
  const onSubmit = jest.fn()
  render(
    <SeatingAutoSeatDialog
      open
      isSubmitting={false}
      onOpenChange={jest.fn()}
      onSubmit={onSubmit}
      {...overrides}
    />
  )
  return { onSubmit }
}

describe('SeatingAutoSeatDialog', () => {
  it('submits with no arguments - no table capacity is sent anymore', async () => {
    const { onSubmit } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'שבץ את כל מי שנשאר' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith())
  })

  it('has no table capacity input', () => {
    renderDialog()

    expect(screen.queryByLabelText('מקומות בשולחן חדש')).not.toBeInTheDocument()
  })
})
