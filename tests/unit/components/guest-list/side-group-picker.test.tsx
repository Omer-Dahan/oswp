import * as DialogPrimitive from '@radix-ui/react-dialog'
import { fireEvent, render, screen } from '@testing-library/react'

import { SideGroupCombobox } from '~/components/forms/guest/side-group-combobox'

// Reproduces the guest detail drawer: a modal Radix Dialog with the
// side/group picker rendered inside it. The picker's option list portals to
// document.body, a DOM sibling of the dialog's own portalled content - this
// is exactly the layout where a plain pointer-events-based dialog lockout
// swallows clicks on the options.
function renderInsideDialog(props: {
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return render(
    <DialogPrimitive.Root open>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay />
        <DialogPrimitive.Content aria-describedby={undefined}>
          <DialogPrimitive.Title>עריכת מוזמן</DialogPrimitive.Title>
          <SideGroupCombobox id='side' {...props} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

describe('side/group picker inside the guest detail drawer', () => {
  const options = ['חתן', 'כלה']

  it('selects an option by click', () => {
    const onChange = jest.fn()
    renderInsideDialog({ value: '', onChange, options })

    fireEvent.focus(screen.getByRole('textbox'))
    fireEvent.click(screen.getByText('כלה'))

    expect(onChange).toHaveBeenCalledWith('כלה')
  })

  it('still selects an option with the keyboard', () => {
    const onChange = jest.fn()
    renderInsideDialog({ value: '', onChange, options })

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('חתן')
  })
})
