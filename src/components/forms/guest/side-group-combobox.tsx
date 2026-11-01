import * as PopoverPrimitive from '@radix-ui/react-popover'
import { useCallback, useMemo, useRef, useState } from 'react'
import { IoIosArrowDown } from 'react-icons/io'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'

type HouseholdSideGroup = Pick<HouseholdWithGuests, 'side' | 'groupName'>

/**
 * Distinct, trimmed side/group values across households, keyed by lowercase
 * so "Groom" and "groom" collapse to one option (mirrors guest-search-filter.tsx).
 */
const CANONICAL_SIDES = ['חתן', 'כלה']

export function useHouseholdSideGroupOptions(households: HouseholdSideGroup[]) {
  return useMemo(() => {
    const sides = new Map<string, string>(CANONICAL_SIDES.map((side) => [side.toLowerCase(), side]))
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
      // Falls back to every known group when the selected side has none of its
      // own yet, so the dropdown is never empty just because no household on
      // that side has been assigned a group.
      groupsForSide: (side: string | null | undefined) => {
        const trimmed = side?.trim()
        if (!trimmed) return Array.from(allGroups.values()).sort()
        const matched = groupsBySide.get(trimmed.toLowerCase())
        if (!matched || matched.size === 0) return Array.from(allGroups.values()).sort()
        return Array.from(matched.values()).sort()
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

/**
 * Free-text input with a dropdown of existing values; typing a new value is
 * always allowed.
 *
 * The list is a Radix Popover anchored to the input rather than a hand-rolled
 * `createPortal`: this component is used inside the guest drawer, a modal
 * Radix Dialog. A plain `document.body` portal lands as a DOM sibling of the
 * dialog's content, and Radix's modal Dialog sets `pointer-events: none` on
 * `<body>` while open (so only the dialog's own layer stays clickable) -
 * clicks on such a sibling are silently swallowed by the browser before any
 * handler runs. Popover's content registers itself in the same Radix layer
 * stack, so it stays interactive on top of the dialog.
 */
export function SideGroupCombobox(props: Readonly<SideGroupComboboxProps>) {
  const { id, value, onChange, options, placeholder, className } = props
  const [isOpen, setIsOpen] = useState(false)
  // null means "no active search" so opening via click/focus always shows the
  // full list instead of being pre-filtered by whatever value is already set.
  const [query, setQuery] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const anchorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredOptions = useMemo(() => {
    const normalized = query?.trim().toLowerCase()
    if (!normalized) return options
    return options.filter((option) => option.toLowerCase().includes(normalized))
  }, [options, query])

  const openList = useCallback(() => {
    setIsOpen(true)
    setQuery(null)
    setActiveIndex(-1)
  }, [])

  const selectOption = useCallback(
    (option: string) => {
      onChange(option)
      setIsOpen(false)
      setQuery(null)
      setActiveIndex(-1)
    },
    [onChange]
  )

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div ref={anchorRef} className='relative flex items-center'>
          <input
            ref={inputRef}
            id={id}
            type='text'
            value={value}
            onChange={(event) => {
              onChange(event.target.value)
              setQuery(event.target.value)
              setActiveIndex(-1)
              if (!isOpen) openList()
            }}
            onFocus={() => openList()}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                if (!isOpen) {
                  openList()
                  return
                }
                setActiveIndex((index) => Math.min(index + 1, filteredOptions.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((index) => Math.max(index - 1, 0))
              } else if (event.key === 'Enter') {
                const active = isOpen ? filteredOptions[activeIndex] : undefined
                if (active !== undefined) {
                  event.preventDefault()
                  selectOption(active)
                }
              } else if (event.key === 'Escape') {
                setIsOpen(false)
              }
            }}
            placeholder={placeholder}
            className={className}
            autoComplete='off'
          />
          <button
            type='button'
            onClick={() => (isOpen ? setIsOpen(false) : openList())}
            aria-label='הצגת אפשרויות'
            className='absolute end-0 flex h-11 w-11 items-center justify-center text-foreground/50 hover:text-foreground'
          >
            <IoIosArrowDown size={14} />
          </button>
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          dir='rtl'
          align='start'
          sideOffset={4}
          collisionPadding={8}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            // Clicking back into the input or the toggle button must not
            // dismiss the list - only the input's own handlers decide that.
            if (anchorRef.current?.contains(event.target as Node)) event.preventDefault()
          }}
          className='z-[96] max-h-48 w-[var(--radix-popover-trigger-width)] overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 text-popover-foreground shadow-md'
        >
          {filteredOptions.length === 0 ? (
            <div className='px-2 py-2 text-center text-foreground/50 text-sm'>אין תוצאות</div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={option}
                type='button'
                className={`flex min-h-11 w-full cursor-pointer items-center rounded-sm px-2 py-2 text-start text-sm transition-colors hover:bg-accent ${
                  index === activeIndex ? 'bg-accent' : ''
                }`}
                onClick={() => selectOption(option)}
              >
                {option}
              </button>
            ))
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
