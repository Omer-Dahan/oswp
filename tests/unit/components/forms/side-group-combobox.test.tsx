import { fireEvent, render, screen } from '@testing-library/react'

import { SideGroupCombobox } from '~/components/forms/guest/side-group-combobox'

describe('SideGroupCombobox', () => {
  const options = ['חתן - חברים', 'חתן - משפחה', 'כלה - חברות']

  it('renders its options in a body portal so a scrolling drawer cannot clip them', () => {
    const { container } = render(
      <div style={{ overflow: 'hidden', height: 40 }}>
        <SideGroupCombobox id='groupName' value='' onChange={jest.fn()} options={options} />
      </div>
    )

    fireEvent.focus(screen.getByRole('textbox'))

    const option = screen.getByText('חתן - משפחה')
    // Inside the portal, not inside the (clipping) wrapper that rendered the input.
    expect(container.contains(option)).toBe(false)
    expect(document.body.contains(option)).toBe(true)
  })

  it('picks an option and reports it', () => {
    const onChange = jest.fn()
    render(<SideGroupCombobox id='side' value='' onChange={onChange} options={options} />)

    fireEvent.focus(screen.getByRole('textbox'))
    fireEvent.click(screen.getByText('כלה - חברות'))

    expect(onChange).toHaveBeenCalledWith('כלה - חברות')
  })

  it('filters as the guest types and still allows a brand-new value', () => {
    const onChange = jest.fn()
    render(<SideGroupCombobox id='side' value='כלה' onChange={onChange} options={options} />)

    fireEvent.focus(screen.getByRole('textbox'))

    expect(screen.getByText('כלה - חברות')).toBeInTheDocument()
    expect(screen.queryByText('חתן - משפחה')).toBeNull()
    // Free text: the input is a plain textbox, not a readonly combobox.
    expect(screen.getByRole('textbox')).not.toHaveAttribute('readonly')
  })
})

describe('SideGroupCombobox scrolling', () => {
  const many = Array.from({ length: 12 }, (_, i) => `קבוצה ${i + 1}`)

  it('stays open while the guest scrolls inside the option list', () => {
    render(<SideGroupCombobox id='groupName' value='' onChange={jest.fn()} options={many} />)

    fireEvent.focus(screen.getByRole('textbox'))
    const option = screen.getByText('קבוצה 3')
    const list = option.parentElement as HTMLElement

    // A scroll inside the list must not dismiss it.
    fireEvent.scroll(list)

    expect(screen.getByText('קבוצה 3')).toBeInTheDocument()
    expect(screen.getByText('קבוצה 12')).toBeInTheDocument()
  })

  it('survives a page scroll (repositions instead of closing)', () => {
    render(<SideGroupCombobox id='groupName' value='' onChange={jest.fn()} options={many} />)

    fireEvent.focus(screen.getByRole('textbox'))
    fireEvent.scroll(window)

    expect(screen.getByText('קבוצה 1')).toBeInTheDocument()
  })
})
