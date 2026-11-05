import { fireEvent, render, screen } from '@testing-library/react'
import { ListToolbar } from '~/components/guest-list/v2/list/list-toolbar'

describe('ListToolbar', () => {
  it('renders one sort menu and one segmented view switch', () => {
    render(<ListToolbar totalHouseholds={3} onViewModeChange={jest.fn()} />)

    expect(screen.getByRole('button', { name: 'מיון: לפי שם' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'מצב תצוגה' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'כרטיסים' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'טבלה' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('changes the segmented view', () => {
    const onViewModeChange = jest.fn()
    render(<ListToolbar totalHouseholds={3} onViewModeChange={onViewModeChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'טבלה' }))
    expect(onViewModeChange).toHaveBeenCalledWith('table')
  })

  it('shows the active sort in the trigger and invokes the menu choices', () => {
    const onSortByName = jest.fn()
    const onSortByPartySize = jest.fn()
    render(
      <ListToolbar
        totalHouseholds={3}
        activeSort={{ field: 'partySize', direction: 'descending' }}
        onSortByName={onSortByName}
        onSortByPartySize={onSortByPartySize}
      />
    )

    fireEvent.keyDown(screen.getByRole('button', { name: 'מיון: לפי גודל' }), { key: 'ArrowDown' })
    fireEvent.click(screen.getByRole('menuitem', { name: 'לפי שם' }))
    expect(onSortByName).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(screen.getByRole('button', { name: 'מיון: לפי גודל' }), { key: 'ArrowDown' })
    fireEvent.click(screen.getByRole('menuitem', { name: 'לפי גודל' }))
    expect(onSortByPartySize).toHaveBeenCalledTimes(1)
  })

  it('marks table as selected when restored', () => {
    render(<ListToolbar totalHouseholds={3} viewMode='table' onViewModeChange={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'טבלה' })).toHaveAttribute('aria-pressed', 'true')
  })
})
