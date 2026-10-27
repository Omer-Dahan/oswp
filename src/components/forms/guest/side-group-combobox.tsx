import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoIosArrowDown } from 'react-icons/io'
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
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filteredOptions = useMemo(() => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return options
    return options.filter((option) => option.toLowerCase().includes(normalized))
  }, [options, value])

  const openList = useCallback((element: HTMLElement | null) => {
    if (!element) return
    const rect = element.getBoundingClientRect()
    setAnchor({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    setIsOpen(true)
  }, [])

  // A fixed-position list cannot follow the drawer while it scrolls, so close it
  // rather than letting it float away from its input.
  useEffect(() => {
    if (!isOpen) return
    const close = () => setIsOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [isOpen])

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
          id={id}
          type='text'
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => openList(event.currentTarget)}
          placeholder={placeholder}
          className={className}
          autoComplete='off'
        />
        {options.length > 0 && (
          <button
            type='button'
            onClick={(event) => {
              if (isOpen) {
                setIsOpen(false)
                return
              }
              const input = event.currentTarget.parentElement?.querySelector('input') ?? null
              openList(input ?? event.currentTarget)
            }}
            aria-label='הצגת אפשרויות'
            className='absolute end-2 text-foreground/50 hover:text-foreground'
          >
            <IoIosArrowDown size={14} />
          </button>
        )}
      </div>
      {isOpen &&
        anchor &&
        filteredOptions.length > 0 &&
        createPortal(
          <div
            ref={listRef}
            dir='rtl'
            style={{ position: 'fixed', top: anchor.top, left: anchor.left, width: anchor.width }}
            className='z-[80] max-h-48 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md'
          >
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
          </div>,
          document.body
        )}
    </div>
  )
}
