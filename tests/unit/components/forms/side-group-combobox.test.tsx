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

  it('keeps the mobile disclosure and options at least 44px tall', () => {
    render(<SideGroupCombobox id='side' value='' onChange={jest.fn()} options={options} />)

    const disclosure = screen.getByRole('button', { name: 'הצגת אפשרויות' })
    expect(disclosure).toHaveClass('h-11', 'w-11')

    fireEvent.focus(screen.getByRole('textbox'))
    expect(screen.getByRole('button', { name: 'חתן - משפחה' })).toHaveClass('min-h-11')
  })

  it('opens the full list on focus even when a value is already set, then filters as the guest types', () => {
    const onChange = jest.fn()
    render(<SideGroupCombobox id='side' value='כלה' onChange={onChange} options={options} />)

    fireEvent.focus(screen.getByRole('textbox'))

    // Opening must show every option, not just ones matching the current
    // value - otherwise picking a different side requires clearing the field first.
    expect(screen.getByText('כלה - חברות')).toBeInTheDocument()
    expect(screen.getByText('חתן - משפחה')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'כלה - חב' } })

    expect(screen.getByText('כלה - חברות')).toBeInTheDocument()
    expect(screen.queryByText('חתן - משפחה')).toBeNull()
    // Free text: the input is a plain textbox, not a readonly combobox.
    expect(screen.getByRole('textbox')).not.toHaveAttribute('readonly')
  })

  it('shows a "no results" message instead of an empty list when nothing matches', () => {
    render(<SideGroupCombobox id='side' value='' onChange={jest.fn()} options={options} />)

    fireEvent.focus(screen.getByRole('textbox'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'זזזזז' } })

    expect(screen.getByText('אין תוצאות')).toBeInTheDocument()
  })

  it('always shows the dropdown chevron, even with no options yet', () => {
    render(<SideGroupCombobox id='side' value='' onChange={jest.fn()} options={[]} />)

    expect(screen.getByRole('button', { name: 'הצגת אפשרויות' })).toBeInTheDocument()
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
