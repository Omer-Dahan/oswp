import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
 * The list is portalled to the body at fixed coordinates: inside the guest
 * drawer it used to be an absolutely-positioned child of a scrolling panel, so
 * the panel's overflow clipped it and the options were unusable.
 */
export function SideGroupCombobox(props: Readonly<SideGroupComboboxProps>) {
  const { id, value, onChange, options, placeholder, className } = props
  const [isOpen, setIsOpen] = useState(false)
  // null means "no active search" so opening via click/focus always shows the
  // full list instead of being pre-filtered by whatever value is already set.
  const [query, setQuery] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredOptions = useMemo(() => {
    const normalized = query?.trim().toLowerCase()
    if (!normalized) return options
    return options.filter((option) => option.toLowerCase().includes(normalized))
  }, [options, query])

  const openList = useCallback((element: HTMLElement | null) => {
    if (!element) return
    const rect = element.getBoundingClientRect()
    setAnchor({ top: rect.bottom + 4, left: rect.left, width: rect.width })
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

  // Keep the fixed list glued to its input instead of closing it: scrolling the
  // list itself must not dismiss it (the drawer scrolls too), so only scrolls
  // that originate outside the list reposition it.
  useEffect(() => {
    if (!isOpen) return
    const reposition = (event?: Event) => {
      const target = event?.target
      if (target instanceof Node && listRef.current?.contains(target)) return
      const element = inputRef.current
      if (!element) return
      const rect = element.getBoundingClientRect()
      const room = window.innerHeight - rect.bottom
      const listHeight = Math.min(192, filteredOptions.length * 36 + 8)
      const top = room > listHeight ? rect.bottom + 4 : Math.max(8, rect.top - listHeight - 4)
      setAnchor({ top, left: rect.left, width: rect.width })
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [isOpen, filteredOptions.length])

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (wrapperRef.current?.contains(target)) return
      if (listRef.current?.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isOpen])

  return (
    <div ref={wrapperRef} className='relative'>
      <div className='relative flex items-center'>
        <input
          ref={inputRef}
          id={id}
          type='text'
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            setQuery(event.target.value)
            setActiveIndex(-1)
            if (!isOpen) openList(event.currentTarget)
          }}
          onFocus={(event) => openList(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              if (!isOpen) {
                openList(event.currentTarget)
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
          onClick={() => {
            if (isOpen) {
              setIsOpen(false)
              return
            }
            openList(inputRef.current)
          }}
          aria-label='הצגת אפשרויות'
          className='absolute end-0 flex h-11 w-11 items-center justify-center text-foreground/50 hover:text-foreground'
        >
          <IoIosArrowDown size={14} />
        </button>
      </div>
      {isOpen &&
        anchor &&
        createPortal(
          <div
            ref={listRef}
            dir='rtl'
            style={{ position: 'fixed', top: anchor.top, left: anchor.left, width: anchor.width }}
            className='z-[96] max-h-48 overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 text-popover-foreground shadow-md'
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
          </div>,
          document.body
        )}
    </div>
  )
}
