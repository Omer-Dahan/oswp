'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'
import { toast } from 'sonner'

import { Badge } from '~/components/ui/badge'
import { MAX_TAGS_PER_GUEST, pickRandomTagColor } from '~/lib/constants'
import { api } from '~/trpc/react'

type Tag = { id: string; name: string; color: string | null }

type TagOption = { type: 'tag'; tag: Tag }
type CreateOption = { type: 'create'; name: string }
type Option = TagOption | CreateOption

type TagInputProps = {
  selectedTagIds: string[]
  tags: Tag[]
  onToggle: (tagId: string) => void
  onTagCreated: (tagId: string) => Promise<void> | void
  ariaLabel?: string
}

export function TagInput({
  selectedTagIds,
  tags,
  onToggle,
  onTagCreated,
  ariaLabel,
}: TagInputProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [dropdownRect, setDropdownRect] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const createTagMutation = api.guestTag.create.useMutation()

  const selectedTags = useMemo(
    () => tags.filter((tag) => selectedTagIds.includes(tag.id)),
    [tags, selectedTagIds]
  )

  const trimmedQuery = query.trim().toLowerCase()
  const isMaxReached = selectedTagIds.length >= MAX_TAGS_PER_GUEST

  const options = useMemo(() => {
    const filtered = trimmedQuery
      ? tags.filter((tag) => tag.name.toLowerCase().includes(trimmedQuery))
      : tags

    const exactMatch = tags.some((tag) => tag.name.toLowerCase() === trimmedQuery)
    const canCreate = trimmedQuery.length > 0 && trimmedQuery.length <= 20 && !exactMatch

    const result: Option[] = filtered.map((tag) => ({ type: 'tag' as const, tag }))
    if (canCreate && !isMaxReached) {
      result.push({ type: 'create' as const, name: query.trim() })
    }
    return result
  }, [tags, trimmedQuery, isMaxReached, query])

  const selectOption = async (index: number) => {
    const option = options[index]
    if (!option) return

    if (option.type === 'tag') {
      const isSelected = selectedTagIds.includes(option.tag.id)
      if (!isSelected && isMaxReached) return
      onToggle(option.tag.id)
      setQuery('')
    } else {
      try {
        const created = await createTagMutation.mutateAsync({
          name: option.name,
          color: pickRandomTagColor(),
        })
        await onTagCreated(created.id)
        onToggle(created.id)
        setQuery('')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'יצירת התגית נכשלה'
        toast.error(message)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true)
      e.preventDefault()
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev + 1) % Math.max(options.length, 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev - 1 + options.length) % Math.max(options.length, 1))
        break
      case 'Enter':
        e.preventDefault()
        if (options.length > 0) {
          selectOption(highlightedIndex)
        }
        break
      case 'Backspace': {
        const lastId = selectedTagIds[selectedTagIds.length - 1]
        if (query === '' && lastId) {
          onToggle(lastId)
        }
        break
      }
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  // Close when clicking outside either the input or the portaled dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (containerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // The dropdown is portaled to <body> so it can't be clipped by a scrollable
  // ancestor (e.g. the household members modal's overflow-y-auto list).
  // Track the input's position so the portal can be placed under it.
  useLayoutEffect(() => {
    if (!isOpen) return

    const updatePosition = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      setDropdownRect({ top: rect.bottom, left: rect.left, width: rect.width })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className='relative'>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click-to-focus wrapper for the embedded input */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard events handled by the embedded input */}
      <div
        className='flex min-h-[36px] flex-wrap items-center gap-1 rounded-md border border-border/70 bg-background px-2 py-1 focus-within:ring-1 focus-within:ring-ring'
        onClick={() => containerRef.current?.querySelector('input')?.focus()}
      >
        {selectedTags.map((tag) => (
          <Badge
            key={tag.id}
            variant='secondary'
            className='flex shrink-0 items-center gap-1 px-1.5 py-0 text-xs'
          >
            {tag.color && (
              <span className='h-2 w-2 rounded-full' style={{ backgroundColor: tag.color }} />
            )}
            {tag.name}
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation()
                onToggle(tag.id)
              }}
              className='ms-0.5 hover:text-destructive'
              aria-label={`הסרת ${tag.name}`}
            >
              <FiX className='h-3 w-3' />
            </button>
          </Badge>
        ))}
        <input
          type='text'
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setHighlightedIndex(0)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length === 0 ? 'הקלידו לחיפוש או ליצירת תגיות...' : ''}
          disabled={isMaxReached && !query}
          className='min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed'
          aria-label={ariaLabel}
        />
      </div>

      {isOpen &&
        options.length > 0 &&
        dropdownRect &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: dropdownRect.top,
              left: dropdownRect.left,
              width: dropdownRect.width,
            }}
            className='z-50 mt-1 max-h-[180px] overflow-y-auto rounded-md border bg-popover shadow-md'
          >
            {options.map((option, i) => {
            if (option.type === 'tag') {
              const { tag } = option
              const isSelected = selectedTagIds.includes(tag.id)
              const disabled = !isSelected && isMaxReached

              return (
                <button
                  key={tag.id}
                  type='button'
                  disabled={disabled}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  onClick={() => selectOption(i)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm ${
                    i === highlightedIndex ? 'bg-accent text-accent-foreground' : ''
                  } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-xs ${
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border'
                    }`}
                  >
                    {isSelected ? '✓' : ''}
                  </span>
                  {tag.color && (
                    <span
                      className='h-2.5 w-2.5 rounded-full'
                      style={{ backgroundColor: tag.color }}
                    />
                  )}
                  {tag.name}
                </button>
              )
            }

            return (
              <button
                key='__create__'
                type='button'
                onMouseEnter={() => setHighlightedIndex(i)}
                onClick={() => selectOption(i)}
                className={`flex w-full items-center gap-2 border-border/50 border-t px-3 py-1.5 text-start text-sm ${
                  i === highlightedIndex ? 'bg-accent text-accent-foreground' : ''
                } cursor-pointer`}
              >
                <span className='text-muted-foreground'>יצירה</span>
                <Badge variant='secondary' className='px-1.5 py-0 text-xs'>
                  {option.name}
                </Badge>
              </button>
            )
          })}
          </div>,
          document.body
        )}
    </div>
  )
}
