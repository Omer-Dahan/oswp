'use client'

import { X } from 'lucide-react'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '~/lib/utils'

/** One slow, gentle journey to the centre — and back. */
const OPEN_MS = 900
const CLOSE_MS = 700
const CURVE_IN = 'cubic-bezier(0.32, 0.72, 0, 1)'
const CURVE_OUT = 'cubic-bezier(0.32, 0.72, 0, 1)'
/** Subtle lift on hover — opening only happens on click. */
const HOVER_MS = 200

const SHADOW_REST = '0 12px 32px rgba(46,38,32,.12)'
const SHADOW_HOVER = '0 20px 48px rgba(46,38,32,.18)'
const SHADOW_GROWN = '0 40px 90px rgba(46,38,32,.28)'

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** The centred square the open card settles into: `min(92vw, 92svh)`. */
function openRect(): { top: number; left: number; size: number } {
  const size = Math.min(window.innerWidth * 0.92, window.innerHeight * 0.92)
  return {
    top: (window.innerHeight - size) / 2,
    left: (window.innerWidth - size) / 2,
    size,
  }
}

/** Transform that, applied to the open square, makes it coincide with `from`. */
function flipTransformFor(from: DOMRect): string {
  const { left, top, size } = openRect()
  const scale = from.width / size
  const dx = from.left + from.width / 2 - (left + size / 2)
  const dy = from.top + from.height / 2 - (top + size / 2)
  return `translate(${dx}px, ${dy}px) scale(${scale})`
}

const IDENTITY_TRANSFORM = 'translate(0px, 0px) scale(1)'

type HeroCardsGroupContextValue = {
  activeId: string | null
  setActiveId: (id: string | null) => void
}

const HeroCardsGroupContext = createContext<HeroCardsGroupContextValue | null>(null)

/** Wraps sibling HeroCards so the one not open recedes while another expands. */
export function HeroCardsGroup({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  const [activeId, setActiveId] = useState<string | null>(null)
  return (
    <HeroCardsGroupContext.Provider value={{ activeId, setActiveId }}>
      <div className={className}>{children}</div>
    </HeroCardsGroupContext.Provider>
  )
}

type HeroCardProps = {
  src: string
  label: string
  expandedAlt: string
  priority?: boolean
  className?: string
  fit?: 'cover' | 'contain'
  /** Below `md`: no hover-intent zoom — there is no hover to dwell on. */
  mobile?: boolean
}

/**
 * One of the home's interactive cards. Hovering only lifts it subtly (scale
 * 1.02 + shadow, 200ms); clicking/tapping journeys it to the centre of the
 * viewport in one slow, continuous 900ms motion, growing to `min(92vw,
 * 92svh)`; the backdrop blurs and veils only once it has arrived, and the
 * greeting/buttons sit beneath it (the open card portals to the top of the
 * body). Leaving, Escape, or a backdrop click returns it in a 700ms reverse
 * journey. Every moving property shares one transition — no stepped
 * intermediate sizes.
 */
export function HeroCard({
  src,
  label,
  expandedAlt,
  priority,
  className,
  fit = 'cover',
  mobile = false,
}: Readonly<HeroCardProps>) {
  const id = useId()
  const group = useContext(HeroCardsGroupContext)
  const reducedMotion = usePrefersReducedMotion()

  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [flipFrom, setFlipFrom] = useState<string | null>(null)
  const [suppressTransition, setSuppressTransition] = useState(false)
  const [settled, setSettled] = useState(false)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flipRafRef = useRef<number | null>(null)

  const isSiblingReceding = group !== null && group.activeId !== null && group.activeId !== id

  useEffect(() => {
    if (open) group?.setActiveId(id)
    else if (group?.activeId === id) group?.setActiveId(null)
  }, [open, id, group])

  // The backdrop blurs and veils only once the card has arrived at the centre:
  // schedule that flip for when the journey completes, and clear it on close.
  useEffect(() => {
    if (!open) {
      setSettled(false)
      return
    }
    if (reducedMotion) {
      setSettled(true)
      return
    }
    settleTimerRef.current = setTimeout(() => setSettled(true), OPEN_MS)
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
    }
  }, [open, reducedMotion])

  // Once the open card mounts at its FLIP start position, release it to the
  // identity transform on the next frame so it journeys to the centre.
  useEffect(() => {
    if (!open || !suppressTransition) return
    const raf1 = requestAnimationFrame(() => {
      flipRafRef.current = requestAnimationFrame(() => {
        setFlipFrom(null)
        setSuppressTransition(false)
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (flipRafRef.current !== null) cancelAnimationFrame(flipRafRef.current)
    }
  }, [open, suppressTransition])

  const close = useCallback(() => {
    setDirection('out')
    if (reducedMotion) {
      setOpen(false)
      setFlipFrom(null)
      triggerRef.current?.focus()
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setFlipFrom(flipTransformFor(rect))
  }, [reducedMotion])

  const handleClick = useCallback(() => {
    if (open) {
      close()
      return
    }
    setDirection('in')
    if (reducedMotion) {
      setOpen(true)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      setFlipFrom(flipTransformFor(rect))
      setSuppressTransition(true)
    }
    setOpen(true)
  }, [open, reducedMotion, close])

  const handleMouseEnter = useCallback(() => {
    if (mobile) return
    setHovered(true)
  }, [mobile])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
  }, [])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  useEffect(() => {
    if (open) closeButtonRef.current?.focus()
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        aria-label={label}
        aria-expanded={open}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'hero-card relative block overflow-hidden rounded-lg border border-border/60 bg-card',
          className ?? 'aspect-square h-[60.5svh] max-h-[634px]'
        )}
        style={{
          opacity: open ? 0 : isSiblingReceding ? 0.35 : 1,
          transform: !open && hovered ? 'scale(1.02)' : 'scale(1)',
          boxShadow: !open && hovered ? SHADOW_HOVER : SHADOW_REST,
          transition: `opacity 300ms cubic-bezier(0.32, 0.72, 0, 1), transform ${HOVER_MS}ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow ${HOVER_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        }}
      >
        <Image
          src={src}
          alt=''
          aria-hidden
          fill
          priority={priority}
          sizes='(min-width: 768px) 40vw, 90vw'
          className={fit === 'contain' ? 'object-contain' : 'object-cover'}
        />
      </button>

      {open &&
        createPortal(
          <div
            className='fixed inset-0 z-50 flex items-center justify-center'
            role='dialog'
            aria-modal='true'
            aria-label={label}
            onClick={(event) => {
              if (event.target === event.currentTarget) close()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Tab') {
                event.preventDefault()
                closeButtonRef.current?.focus()
              }
            }}
          >
            <div
              aria-hidden
              className='absolute inset-0'
              style={{
                backgroundColor: `oklch(0.2 0.01 48 / ${settled ? 38 : 0}%)`,
                filter: `blur(${settled ? 12 : 0}px)`,
                transition: reducedMotion
                  ? 'none'
                  : 'background-color 350ms cubic-bezier(0.32, 0.72, 0, 1), filter 350ms cubic-bezier(0.32, 0.72, 0, 1)',
              }}
            />
            <div
              className='relative h-[min(92svh,92vw)] w-[min(92svh,92vw)] overflow-hidden rounded-xl bg-card'
              style={{
                transform: flipFrom ?? IDENTITY_TRANSFORM,
                transformOrigin: 'center',
                boxShadow: SHADOW_GROWN,
                transition: suppressTransition
                  ? 'none'
                  : reducedMotion
                    ? 'none'
                    : direction === 'in'
                      ? `transform ${OPEN_MS}ms ${CURVE_IN}, box-shadow ${OPEN_MS}ms ${CURVE_IN}`
                      : `transform ${CLOSE_MS}ms ${CURVE_OUT}, box-shadow ${CLOSE_MS}ms ${CURVE_OUT}`,
              }}
              onTransitionEnd={(event) => {
                if (event.target !== event.currentTarget) return
                if (event.propertyName !== 'transform') return
                if (direction !== 'out') return
                setOpen(false)
                setFlipFrom(null)
                triggerRef.current?.focus()
              }}
            >
              <Image src={src} alt={expandedAlt} fill sizes='100vw' className='object-contain' />
              <button
                ref={closeButtonRef}
                type='button'
                onClick={close}
                aria-label='סגירה'
                className='absolute end-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition duration-150 ease-out hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]'
              >
                <X className='size-4' aria-hidden />
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
