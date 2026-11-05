import { fireEvent, render, screen } from '@testing-library/react'

import { ListToolbar } from '~/components/guest-list/v2/list/list-toolbar'

describe('ListToolbar', () => {
  it('shows household count and sort actions', () => {
    render(<ListToolbar totalHouseholds={2} />)

    expect(screen.getByText(/משקי בית/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'מיון לפי שם' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'מיון לפי גודל קבוצה' })).toBeInTheDocument()
  })

  it('invokes sort handlers when buttons are clicked', () => {
    const onSortByName = jest.fn()
    const onSortByPartySize = jest.fn()

    render(
      <ListToolbar
        totalHouseholds={1}
        onSortByName={onSortByName}
        onSortByPartySize={onSortByPartySize}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'מיון לפי שם' }))
    fireEvent.click(screen.getByRole('button', { name: 'מיון לפי גודל קבוצה' }))

    expect(onSortByName).toHaveBeenCalledTimes(1)
    expect(onSortByPartySize).toHaveBeenCalledTimes(1)
  })

  it('shows cards as the default active view state', () => {
    render(<ListToolbar totalHouseholds={3} onViewModeChange={jest.fn()} />)

    expect(screen.getByRole('button', { name: 'תצוגת כרטיסים' })).toHaveClass('bg-primary')
    expect(screen.getByRole('button', { name: 'תצוגת טבלה' })).not.toHaveClass('bg-primary')
  })

  it('shows table as the active view state when requested', () => {
    render(<ListToolbar totalHouseholds={3} viewMode='table' onViewModeChange={jest.fn()} />)

    expect(screen.getByRole('button', { name: 'תצוגת טבלה' })).toHaveClass('bg-primary')
    expect(screen.getByRole('button', { name: 'תצוגת כרטיסים' })).not.toHaveClass('bg-primary')
  })

  it('shows workflow mode controls and calls mode change handler', () => {
    const onWorkflowModeChange = jest.fn()

    render(
      <ListToolbar
        totalHouseholds={3}
        workflowMode='households'
        onWorkflowModeChange={onWorkflowModeChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'ביקורת אנשים' }))
    expect(onWorkflowModeChange).toHaveBeenCalledWith('personAudit')
  })

  it('renders active sort state text when provided', () => {
    render(<ListToolbar totalHouseholds={3} sortStateLabel='Name (A-Z)' />)
    expect(screen.getByText('ממוין לפי Name (A-Z)')).toBeInTheDocument()
  })

  it('highlights the name sort button when name sort is active', () => {
    render(
      <ListToolbar totalHouseholds={3} activeSort={{ field: 'name', direction: 'ascending' }} />
    )

    expect(screen.getByRole('button', { name: 'מיון לפי שם' })).toHaveClass('bg-primary')
    expect(screen.getByRole('button', { name: 'מיון לפי גודל קבוצה' })).not.toHaveClass(
      'bg-primary'
    )
  })

  it('highlights the party size sort button when party sort is active', () => {
    render(
      <ListToolbar
        totalHouseholds={3}
        activeSort={{ field: 'partySize', direction: 'descending' }}
      />
    )

    expect(screen.getByRole('button', { name: 'מיון לפי גודל קבוצה' })).toHaveClass('bg-primary')
    expect(screen.getByRole('button', { name: 'מיון לפי שם' })).not.toHaveClass('bg-primary')
  })

  it('shows no sort button highlighted when activeSort is not provided', () => {
    render(<ListToolbar totalHouseholds={3} />)

    expect(screen.getByRole('button', { name: 'מיון לפי שם' })).not.toHaveClass('bg-primary')
    expect(screen.getByRole('button', { name: 'מיון לפי גודל קבוצה' })).not.toHaveClass(
      'bg-primary'
    )
  })
})
