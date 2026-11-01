import { renderHook } from '@testing-library/react'

import { useHouseholdSideGroupOptions } from '~/components/forms/guest/side-group-combobox'

describe('useHouseholdSideGroupOptions', () => {
  it('always offers the canonical sides even with no households yet', () => {
    const { result } = renderHook(() => useHouseholdSideGroupOptions([]))

    expect(result.current.sides).toEqual(['חתן', 'כלה'])
  })

  it('adds distinct existing sides to the canonical list, without duplicates', () => {
    const { result } = renderHook(() =>
      useHouseholdSideGroupOptions([
        { side: 'חתן', groupName: null },
        { side: 'משפחה מורחבת', groupName: null },
        { side: 'משפחה מורחבת', groupName: null },
      ])
    )

    expect(result.current.sides).toEqual(['חתן', 'כלה', 'משפחה מורחבת'].sort())
  })

  it('falls back to every known group when the selected side has none of its own', () => {
    const { result } = renderHook(() =>
      useHouseholdSideGroupOptions([
        { side: 'חתן', groupName: 'חברים' },
        { side: 'כלה', groupName: 'עבודה' },
      ])
    )

    // "משפחת הדוד" never appears with a group, so it must still surface every
    // known group rather than leaving the dropdown empty.
    expect(result.current.groupsForSide('משפחת הדוד')).toEqual(['חברים', 'עבודה'].sort())
  })

  it('returns only the groups tied to a side when that side does have its own', () => {
    const { result } = renderHook(() =>
      useHouseholdSideGroupOptions([
        { side: 'חתן', groupName: 'חברים' },
        { side: 'חתן', groupName: 'עבודה' },
        { side: 'כלה', groupName: 'משפחה' },
      ])
    )

    expect(result.current.groupsForSide('חתן')).toEqual(['חברים', 'עבודה'].sort())
  })

  it('returns every group when no side is selected yet', () => {
    const { result } = renderHook(() =>
      useHouseholdSideGroupOptions([
        { side: 'חתן', groupName: 'חברים' },
        { side: 'כלה', groupName: 'משפחה' },
      ])
    )

    expect(result.current.groupsForSide(null)).toEqual(['חברים', 'משפחה'].sort())
    expect(result.current.groupsForSide('')).toEqual(['חברים', 'משפחה'].sort())
  })
})
