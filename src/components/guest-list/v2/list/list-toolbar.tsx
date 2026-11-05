import { Check, ChevronDown, LayoutGrid, Table2 } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

export type ViewMode = 'cards' | 'table'
export type WorkflowMode = 'households' | 'personAudit'

type ActiveSort = {
  field: 'name' | 'partySize'
  direction: 'ascending' | 'descending'
}

type ListToolbarProps = {
  totalHouseholds: number
  totalUnfilteredHouseholds?: number
  totalGuests?: number
  totalUnfilteredGuests?: number
  onSortByName?: () => void
  onSortByPartySize?: () => void
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  workflowMode?: WorkflowMode
  onWorkflowModeChange?: (mode: WorkflowMode) => void
  sortStateLabel?: string
  activeSort?: ActiveSort
  onResetView?: () => void
}

export function ListToolbar({
  onSortByName,
  onSortByPartySize,
  viewMode = 'cards',
  onViewModeChange,
  activeSort,
}: Readonly<ListToolbarProps>) {
  const sortLabel = activeSort?.field === 'partySize' ? 'לפי גודל' : 'לפי שם'

  return (
    <div className='flex min-h-11 items-center justify-end gap-2 border-b border-border pb-3'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type='button'
            className='inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-hebrew text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          >
            מיון: {sortLabel}
            <ChevronDown className='h-4 w-4' aria-hidden='true' />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-48 font-hebrew'>
          <DropdownMenuLabel>מיון הרשימה</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSortByName} className='min-h-11'>
            <Check
              className={activeSort?.field === 'name' ? 'opacity-100' : 'opacity-0'}
              aria-hidden='true'
            />
            לפי שם
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onSortByPartySize} className='min-h-11'>
            <Check
              className={activeSort?.field === 'partySize' ? 'opacity-100' : 'opacity-0'}
              aria-hidden='true'
            />
            לפי גודל
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {onViewModeChange ? (
        <fieldset className='flex rounded-[10px] bg-muted p-1'>
          <legend className='sr-only'>מצב תצוגה</legend>
          <ViewButton
            active={viewMode === 'cards'}
            onClick={() => onViewModeChange('cards')}
            label='כרטיסים'
            icon={<LayoutGrid className='h-4 w-4' aria-hidden='true' />}
          />
          <ViewButton
            active={viewMode === 'table'}
            onClick={() => onViewModeChange('table')}
            label='טבלה'
            icon={<Table2 className='h-4 w-4' aria-hidden='true' />}
          />
        </fieldset>
      ) : null}
    </div>
  )
}

function ViewButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: ReactNode
}) {
  return (
    <button
      type='button'
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 font-hebrew text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {icon}
      {label}
    </button>
  )
}
