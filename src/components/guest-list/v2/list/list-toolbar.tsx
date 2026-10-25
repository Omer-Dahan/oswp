import { ArrowDown, ArrowUp, ArrowUpDown, LayoutGrid, Table2, Users } from 'lucide-react'

import { Button } from '~/components/ui/button'

export type ViewMode = 'cards' | 'table'
export type WorkflowMode = 'households' | 'personAudit'

type SortDirection = 'ascending' | 'descending'

type ActiveSort = {
  field: 'name' | 'partySize'
  direction: SortDirection
}

type ListToolbarProps = {
  totalHouseholds: number
  totalUnfilteredHouseholds?: number
  totalGuests: number
  totalUnfilteredGuests?: number
  onSortByName?: () => void
  onSortByPartySize?: () => void
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  workflowMode?: WorkflowMode
  onWorkflowModeChange?: (mode: WorkflowMode) => void
  sortStateLabel?: string
  activeSort?: ActiveSort
}

function SortIcon({ active, direction }: { active: boolean; direction?: SortDirection }) {
  if (!active) return <ArrowUpDown className='me-2 h-3 w-3' aria-hidden='true' />
  if (direction === 'ascending') return <ArrowUp className='me-2 h-3 w-3' aria-hidden='true' />
  return <ArrowDown className='me-2 h-3 w-3' aria-hidden='true' />
}

export function ListToolbar({
  totalHouseholds,
  totalUnfilteredHouseholds,
  totalGuests,
  totalUnfilteredGuests,
  onSortByName,
  onSortByPartySize,
  viewMode = 'cards',
  onViewModeChange,
  workflowMode = 'households',
  onWorkflowModeChange,
  sortStateLabel,
  activeSort,
}: Readonly<ListToolbarProps>) {
  const isFiltered =
    totalUnfilteredHouseholds !== undefined && totalUnfilteredHouseholds > totalHouseholds

  const householdsLabel = (count: number) => `${count} ${count === 1 ? 'משק בית' : 'משקי בית'}`

  const householdCountLabel = isFiltered
    ? `${totalGuests} מוזמנים · ${householdsLabel(totalHouseholds)} מתוך ${totalUnfilteredGuests} מוזמנים · ${householdsLabel(totalUnfilteredHouseholds)}`
    : `${totalGuests} מוזמנים · ${householdsLabel(totalHouseholds)}`

  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
      <div className='flex flex-col gap-1'>
        <div className='flex items-center gap-2 text-muted-foreground text-sm'>
          <Users className='h-4 w-4' aria-hidden='true' />
          <span>{householdCountLabel}</span>
        </div>
        {sortStateLabel ? (
          <span className='text-muted-foreground text-xs'>ממוין לפי {sortStateLabel}</span>
        ) : null}
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        {onWorkflowModeChange ? (
          <WorkflowModeToggle
            workflowMode={workflowMode}
            onWorkflowModeChange={onWorkflowModeChange}
          />
        ) : null}
        <Button
          type='button'
          variant={activeSort?.field === 'name' ? 'default' : 'outline'}
          size='sm'
          onClick={onSortByName}
          className='font-sans text-sm normal-case tracking-normal'
        >
          <SortIcon active={activeSort?.field === 'name'} direction={activeSort?.direction} />
          מיון לפי שם
        </Button>
        <Button
          type='button'
          variant={activeSort?.field === 'partySize' ? 'default' : 'outline'}
          size='sm'
          onClick={onSortByPartySize}
          className='font-sans text-sm normal-case tracking-normal'
        >
          <SortIcon active={activeSort?.field === 'partySize'} direction={activeSort?.direction} />
          מיון לפי גודל קבוצה
        </Button>
        {onViewModeChange && workflowMode === 'households' && (
          <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
        )}
      </div>
    </div>
  )
}

const toggleBtnClass = (isActive: boolean, hasBorderLeft = false) =>
  `flex items-center px-2.5 py-1.5 transition-colors${hasBorderLeft ? ' border-border border-s' : ''} ${
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'bg-background text-foreground/60 hover:bg-muted/50'
  }`

function ViewModeToggle({
  viewMode,
  onViewModeChange,
}: {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}) {
  return (
    <div className='flex overflow-hidden rounded-md border border-border'>
      <button
        type='button'
        aria-label='תצוגת כרטיסים'
        onClick={() => onViewModeChange('cards')}
        className={toggleBtnClass(viewMode === 'cards')}
      >
        <LayoutGrid className='h-3.5 w-3.5' aria-hidden='true' />
      </button>
      <button
        type='button'
        aria-label='תצוגת טבלה'
        onClick={() => onViewModeChange('table')}
        className={toggleBtnClass(viewMode === 'table', true)}
      >
        <Table2 className='h-3.5 w-3.5' aria-hidden='true' />
      </button>
    </div>
  )
}

function WorkflowModeToggle({
  workflowMode,
  onWorkflowModeChange,
}: {
  workflowMode: WorkflowMode
  onWorkflowModeChange: (mode: WorkflowMode) => void
}) {
  return (
    <div className='flex overflow-hidden rounded-md border border-border'>
      <button
        type='button'
        aria-label='משקי בית'
        onClick={() => onWorkflowModeChange('households')}
        className={toggleBtnClass(workflowMode === 'households')}
      >
        משקי בית
      </button>
      <button
        type='button'
        aria-label='ביקורת אנשים'
        onClick={() => onWorkflowModeChange('personAudit')}
        className={toggleBtnClass(workflowMode === 'personAudit', true)}
      >
        ביקורת אנשים
      </button>
    </div>
  )
}
