import { fireEvent, render, screen } from '@testing-library/react'

import { SeatingGroupRail } from '~/components/seating-chart/seating-group-rail'
import type {
  SeatingGroupSummary,
  SeatingHousehold,
  SeatingPlacementSuggestion,
} from '~/server/domains/seating/seating.types'

const groups: SeatingGroupSummary[] = [
  { side: 'חתן', groupName: 'חברים', assignedHouseholds: 0, unassignedHouseholds: 3, seatsNeeded: 12 },
  { side: 'כלה', groupName: 'משפחה', assignedHouseholds: 1, unassignedHouseholds: 1, seatsNeeded: 2 },
]

const households: SeatingHousehold[] = [
  {
    id: 'h1',
    address: null,
    notes: null,
    invitedCount: null,
    attendingCount: null,
    guests: [
      {
        id: 1,
        firstName: 'דנה',
        lastName: 'כהן',
        email: null,
        phone: null,
        ageGroup: 'ADULT',
        isPrimaryContact: true,
        isTagAlong: false,
        householdId: 'h1',
        rsvp: 'Attending',
        dietaryRestrictions: null,
        tags: [],
        tableId: null,
      },
    ],
  },
]

const suggestion = (overrides: Partial<SeatingPlacementSuggestion> = {}): SeatingPlacementSuggestion => ({
  tableId: 'table-1',
  tableName: 'שולחן 1',
  reason: 'קרוב לשולחן ההורים',
  openSeats: 4,
  seatsNeeded: 2,
  fits: true,
  householdIds: ['h1'],
  ...overrides,
})

const baseProps = {
  groups,
  households,
  selectedGroup: null,
  onSelectGroup: jest.fn(),
  suggestions: [],
  isLoadingSuggestions: false,
  selectedSuggestion: null,
  onSelectSuggestion: jest.fn(),
  onApply: jest.fn(),
  isApplying: false,
  onAddTable: jest.fn(),
  canUndo: false,
  onUndoLastApply: jest.fn(),
}

describe('SeatingGroupRail', () => {
  it('shows each group with its unassigned household and seat counts', () => {
    render(<SeatingGroupRail {...baseProps} />)

    const groupButton = screen.getByRole('button', { name: /חתן · חברים/ })
    expect(groupButton).toHaveTextContent('3 משקי בית')
    expect(groupButton).toHaveTextContent('12 מקומות')
  })

  it('selecting a group requests its suggestions and shows the reason', () => {
    const onSelectGroup = jest.fn()
    render(
      <SeatingGroupRail
        {...baseProps}
        onSelectGroup={onSelectGroup}
        selectedGroup={{ side: 'חתן', groupName: 'חברים' }}
        suggestions={[suggestion()]}
      />
    )

    expect(screen.getByText('קרוב לשולחן ההורים')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /חתן · חברים/ }))
    expect(onSelectGroup).toHaveBeenCalledWith(null)
  })

  it('marks a suggestion that does not fit and keeps it unselectable', () => {
    const onSelectSuggestion = jest.fn()
    render(
      <SeatingGroupRail
        {...baseProps}
        selectedGroup={{ side: 'חתן', groupName: 'חברים' }}
        suggestions={[suggestion({ fits: false, openSeats: 1 })]}
        onSelectSuggestion={onSelectSuggestion}
      />
    )

    const card = screen.getByRole('button', { name: /שולחן 1/ })
    expect(card).toHaveTextContent('לא נכנס')
    fireEvent.click(card)
    expect(onSelectSuggestion).not.toHaveBeenCalled()
  })

  it('previews the households that will be seated and applies with the chosen table', () => {
    const onApply = jest.fn()
    render(
      <SeatingGroupRail
        {...baseProps}
        selectedGroup={{ side: 'חתן', groupName: 'חברים' }}
        suggestions={[suggestion()]}
        selectedSuggestion={suggestion()}
        onApply={onApply}
      />
    )

    expect(screen.getByText('משפחת כהן')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'שבץ' }))
    expect(onApply).toHaveBeenCalledWith({ tableId: 'table-1', householdIds: ['h1'] })
  })

  it('offers to undo the last placement and calls the handler', () => {
    const onUndoLastApply = jest.fn()
    render(<SeatingGroupRail {...baseProps} canUndo onUndoLastApply={onUndoLastApply} />)

    fireEvent.click(screen.getByRole('button', { name: 'ביטול השיבוץ האחרון' }))
    expect(onUndoLastApply).toHaveBeenCalled()
  })
})
