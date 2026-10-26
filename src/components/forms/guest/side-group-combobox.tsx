import { useMemo, useState } from 'react'
import { IoIosArrowDown } from 'react-icons/io'
import { useOuterClick } from '~/components/hooks'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'

type HouseholdSideGroup = Pick<HouseholdWithGuests, 'side' | 'groupName'>

/**
 * Distinct, trimmed side/group values across households, keyed by lowercase
 * so "Groom" and "groom" collapse to one option (mirrors guest-search-filter.tsx).
 */
export function useHouseholdSideGroupOptions(households: HouseholdSideGroup[]) {
  return useMemo(() => {
    const sides = new Map<string, string>()
    const groupsBySide = new Map<string, Map<string, string>>()
    const allGroups = new Map<string, string>()

    for (const household of households) {
      const side = household.side?.trim()
      const group = household.groupName?.trim()

      if (side) sides.set(side.toLowerCase(), side)
      if (group) allGroups.set(group.toLowerCase(), group)

      if (side && group) {
        const sideKey = side.toLowerCase()
        const existing = groupsBySide.get(sideKey) ?? new Map<string, string>()
        existing.set(group.toLowerCase(), group)
        groupsBySide.set(sideKey, existing)
      }
    }

    return {
      sides: Array.from(sides.values()).sort(),
      allGroups: Array.from(allGroups.values()).sort(),
      groupsForSide: (side: string | null | undefined) => {
        const trimmed = side?.trim()
        if (!trimmed) return Array.from(allGroups.values()).sort()
        const matched = groupsBySide.get(trimmed.toLowerCase())
        return matched ? Array.from(matched.values()).sort() : []
      },
    }
  }, [households])
}

type SideGroupComboboxProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  className?: string
}

/** Free-text input with a dropdown of existing values; typing a new value is always allowed. */
export function SideGroupCombobox(props: Readonly<SideGroupComboboxProps>) {
  const { id, value, onChange, options, placeholder, className } = props
  const [isOpen, setIsOpen] = useState(false)
  const ref = useOuterClick<HTMLDivElement>(() => setIsOpen(false))

  const filteredOptions = useMemo(() => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return options
    return options.filter((option) => option.toLowerCase().includes(normalized))
  }, [options, value])

  return (
    <div ref={ref} className='relative'>
      <div className='relative flex items-center'>
        <input
          id={id}
          type='text'
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={className}
          autoComplete='off'
        />
        {options.length > 0 && (
          <button
            type='button'
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label='הצגת אפשרויות'
            className='absolute end-2 text-foreground/50 hover:text-foreground'
          >
            <IoIosArrowDown size={14} />
          </button>
        )}
      </div>
      {isOpen && filteredOptions.length > 0 && (
        <div className='absolute top-full start-0 z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md'>
          {filteredOptions.map((option) => (
            <button
              key={option}
              type='button'
              className='flex w-full cursor-pointer items-center rounded-sm p-2 text-start text-sm transition-colors hover:bg-accent'
              onClick={() => {
                onChange(option)
                setIsOpen(false)
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
