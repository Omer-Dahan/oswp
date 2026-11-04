import {
  clearGuestListViewState,
  DEFAULT_GUEST_LIST_VIEW_STATE,
  guestListViewStateKey,
  readGuestListViewState,
  writeGuestListViewState,
} from '~/components/guest-list/guest-list-view-state'

describe('guest list view persistence', () => {
  beforeEach(() => localStorage.clear())

  it('applies a stored value and writes a toggled mode', () => {
    const stored = { ...DEFAULT_GUEST_LIST_VIEW_STATE, viewMode: 'table' as const }
    writeGuestListViewState('wedding-1', stored)

    expect(readGuestListViewState('wedding-1')).toEqual(stored)
    expect(localStorage.getItem(guestListViewStateKey('wedding-1'))).toContain('"viewMode":"table"')
  })

  it('clears the wedding-scoped value', () => {
    writeGuestListViewState('wedding-1', DEFAULT_GUEST_LIST_VIEW_STATE)
    clearGuestListViewState('wedding-1')

    expect(localStorage.getItem(guestListViewStateKey('wedding-1'))).toBeNull()
  })
})
