'use client'

import { useMemo } from 'react'

import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'
import type {
  SeatingGroupSummary,
  SeatingHousehold,
  SeatingPlacementSuggestion,
} from '~/server/domains/seating/seating.types'

export type SeatingGroupKey = { side: string | null; groupName: string | null }

type SeatingGroupRailProps = {
  groups: SeatingGroupSummary[]
  households: SeatingHousehold[]
  selectedGroup: SeatingGroupKey | null
  onSelectGroup: (group: SeatingGroupKey | null) => void
  suggestions: SeatingPlacementSuggestion[]
  isLoadingSuggestions: boolean
  selectedSuggestion: SeatingPlacementSuggestion | null
  onSelectSuggestion: (suggestion: SeatingPlacementSuggestion | null) => void
  onApply: (input: { tableId: string; householdIds: string[] }) => void
  isApplying: boolean
  onAddTable: () => void
  canUndo: boolean
  onUndoLastApply: () => void
}

export const groupKey = (group: SeatingGroupKey): string =>
  `${group.side ?? ''}\u0000${group.groupName ?? ''}`

const groupLabel = (group: SeatingGroupKey): string =>
  [group.side, group.groupName].filter(Boolean).join(' · ') || 'ללא קבוצה'

const householdLabel = (household: SeatingHousehold): string => {
  const lead = household.guests[0]
  if (!lead) return 'משק בית'
  return lead.lastName ? `משפחת ${lead.lastName}` : `${lead.firstName} ${lead.lastName}`.trim()
}

export function SeatingGroupRail(props: Readonly<SeatingGroupRailProps>) {
  const {
    groups,
    households,
    selectedGroup,
    onSelectGroup,
    suggestions,
    isLoadingSuggestions,
    selectedSuggestion,
    onSelectSuggestion,
    onApply,
    isApplying,
    onAddTable,
    canUndo,
    onUndoLastApply,
  } = props

  // Side first, then size (seats needed) descending, so the biggest unseated
  // groups on each side surface at the top
  const sortedGroups = useMemo(
    () =>
      [...groups].sort(
        (a, b) => (a.side ?? '').localeCompare(b.side ?? '') || b.seatsNeeded - a.seatsNeeded
      ),
    [groups]
  )

  const householdsById = useMemo(
    () => new Map(households.map((household) => [household.id, household])),
    [households]
  )

  const previewHouseholds = selectedSuggestion
    ? selectedSuggestion.householdIds
        .map((id) => householdsById.get(id))
        .filter((household): household is SeatingHousehold => household !== undefined)
    : []

  return (
    <aside
      aria-label='קבוצות הושבה'
      className='flex h-[40vh] min-h-0 flex-col rounded-xl border border-border bg-card shadow-sm lg:h-auto'
    >
      <div className='border-border/70 border-b p-3'>
        <h2 className='font-medium text-sm'>קבוצות הושבה</h2>
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto p-2'>
        {sortedGroups.length === 0 ? (
          <p className='px-2 py-6 text-center text-muted-foreground text-sm'>
            לכולם יש מקום. אין קבוצות שמחכות לשיבוץ.
          </p>
        ) : (
          <ul className='space-y-2'>
            {sortedGroups
              .filter((group) => group.unassignedHouseholds > 0)
              .map((group) => {
                const key = groupKey(group)
                const isSelected = selectedGroup !== null && groupKey(selectedGroup) === key

                return (
                  <li key={key} className='rounded-md border border-border/70 bg-card'>
                    <button
                      type='button'
                      aria-expanded={isSelected}
                      onClick={() => onSelectGroup(isSelected ? null : { side: group.side, groupName: group.groupName })}
                      className='flex w-full items-center justify-between gap-2 px-2 py-1.5 text-start text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    >
                      <span className='truncate font-medium'>{groupLabel(group)}</span>
                      <span className='flex shrink-0 items-center gap-2 text-[0.6rem] text-muted-foreground tabular-nums'>
                        <span>{group.unassignedHouseholds} משקי בית</span>
                        <span>{group.seatsNeeded} מקומות</span>
                      </span>
                    </button>

                    {isSelected ? (
                      <div className='space-y-2 border-border/70 border-t p-2'>
                        {isLoadingSuggestions ? (
                          <p className='text-muted-foreground text-xs'>מחפש שולחנות מתאימים...</p>
                        ) : suggestions.length === 0 ? (
                          <div className='space-y-2'>
                            <p className='text-muted-foreground text-xs'>
                              חסרים מקומות לקבוצה הזו באולם. הוסיפו שולחן כדי להמשיך.
                            </p>
                            <Button type='button' size='sm' variant='outline' onClick={onAddTable}>
                              הוסיפו שולחן
                            </Button>
                          </div>
                        ) : (
                          <ul className='space-y-1.5'>
                            {suggestions.map((suggestion) => {
                              const isChosen =
                                selectedSuggestion?.tableId === suggestion.tableId &&
                                isSelected

                              return (
                                <li key={suggestion.tableId}>
                                  <button
                                    type='button'
                                    disabled={!suggestion.fits}
                                    aria-pressed={isChosen}
                                    onClick={() =>
                                      onSelectSuggestion(isChosen ? null : suggestion)
                                    }
                                    className={cn(
                                      'flex w-full flex-col gap-0.5 rounded-md border px-2 py-1.5 text-start text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                      isChosen
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border/70 hover:bg-muted',
                                      !suggestion.fits && 'cursor-not-allowed opacity-60'
                                    )}
                                  >
                                    <span className='flex items-center justify-between gap-2'>
                                      <span className='font-medium'>{suggestion.tableName}</span>
                                      {!suggestion.fits ? (
                                        <span className='text-destructive'>לא נכנס</span>
                                      ) : null}
                                    </span>
                                    <span className='text-muted-foreground'>{suggestion.reason}</span>
                                    <span className='text-muted-foreground tabular-nums'>
                                      {suggestion.openSeats} מקומות פנויים · נדרשים{' '}
                                      {suggestion.seatsNeeded}
                                    </span>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        )}

                        {selectedSuggestion && isSelected ? (
                          <div className='space-y-2 rounded-md border border-border/70 bg-muted/40 p-2'>
                            <p className='font-medium text-xs'>
                              ישבצו ל{selectedSuggestion.tableName}:
                            </p>
                            <ul className='space-y-0.5 text-muted-foreground text-xs'>
                              {previewHouseholds.map((household) => (
                                <li key={household.id}>{householdLabel(household)}</li>
                              ))}
                            </ul>
                            <Button
                              type='button'
                              size='sm'
                              onClick={() =>
                                onApply({
                                  tableId: selectedSuggestion.tableId,
                                  householdIds: selectedSuggestion.householdIds,
                                })
                              }
                              disabled={isApplying}
                            >
                              שבץ
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
          </ul>
        )}
      </div>
      {canUndo ? (
        <div className='border-border/70 border-t p-2'>
          <Button type='button' size='sm' variant='outline' className='w-full' onClick={onUndoLastApply}>
            ביטול השיבוץ האחרון
          </Button>
        </div>
      ) : null}
    </aside>
  )
}
