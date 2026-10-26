'use client'

import { X } from 'lucide-react'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '~/lib/utils'

type Mode = 'rest' | 'read' | 'full'
type Direction = 'in' | 'out'

/** The only JS timer in this component: how long the pointer must dwell before the card grows. */
const HOVER_INTENT_MS = 250
const READ_GROW_MS = 650
const FULL_GROW_MS = 550
const SHRINK_MS = 450
const CURVE_IN = 'cubic-bezier(0.22, 1, 0.36, 1)'
const CURVE_OUT = 'cubic-bezier(0.64, 0, 0.78, 0)'

const SHADOW_REST = '0 12px 32px rgba(46,38,32,.12)'
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

function growDurationMs(mode: Mode): number {
  return mode === 'read' ? READ_GROW_MS : FULL_GROW_MS
}

/** One continuous transition per element: same duration/curve for every property that moves. */
function cardTransition(direction: Direction, mode: Mode, reducedMotion: boolean): string {
  if (reducedMotion) return 'none'
  const duration = direction === 'in' ? growDurationMs(mode) : SHRINK_MS
  const curve = direction === 'in' ? CURVE_IN : CURVE_OUT
  return ['transform', 'opacity', 'filter', 'box-shadow']
    .map((property) => `${property} ${duration}ms ${curve}`)
    .join(', ')
}

function backdropTransition(direction: Direction, reducedMotion: boolean): string {
  if (reducedMotion) return 'none'
  const duration = direction === 'in' ? FULL_GROW_MS : SHRINK_MS
  const curve = direction === 'in' ? CURVE_IN : CURVE_OUT
  return `background-color ${duration}ms ${curve}, filter ${duration}ms ${curve}`
}

type Rect = { top: number; left: number; width: number; height: number }

/** The viewport-filling square the full mode settles into: `min(100svh, 100vw)`, centred. */
function fullScreenRect(): Rect {
  const size = Math.min(window.innerHeight, window.innerWidth)
  return {
    top: (window.innerHeight - size) / 2,
    left: (window.innerWidth - size) / 2,
    width: size,
    height: size,
  }
}

/** Transform that, applied to the full-screen box, makes it visually coincide with `from`. */
function flipTransformFor(from: Rect): string {
  const final = fullScreenRect()
  const scale = from.width / final.width
  const dx = from.left + from.width / 2 - (final.left + final.width / 2)
  const dy = from.top + from.height / 2 - (final.top + final.height / 2)
  return `translate(${dx}px, ${dy}px) scale(${scale})`
}

/** Scale that grows `rect`'s long side to `min(88vw, 88svh)`. */
function readScaleFor(rect: Rect): number {
  const target = Math.min(window.innerWidth * 0.88, window.innerHeight * 0.88)
  return target / rect.width
}

const IDENTITY_TRANSFORM = 'translate(0px, 0px) scale(1)'

type HeroCardsGroupContextValue = {
  activeId: string | null
  setActiveId: (id: string | null) => void
}

const HeroCardsGroupContext = createContext<HeroCardsGroupContextValue | null>(null)

/** Wraps sibling HeroCards so the one not being read recedes while another expands. */
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
  /** Accessible name for the card's trigger button and the expanded dialog. */
  label: string
  /** Set on the expanded image only; the card thumbnail stays decorative. */
  expandedAlt: string
  priority?: boolean
  /** Thumbnail sizing; defaults to the desktop square. Mobile passes its own max-height box. */
  className?: string
  /** Thumbnail object-fit; desktop crops to fill the square, mobile shows the whole artwork. */
  fit?: 'cover' | 'contain'
  /** Below `md`: no hover-intent zoom, since there is no hover to dwell on. */
  mobile?: boolean
}

/**
 * One of the home's interactive cards. Resting the pointer on it for 250ms
 * (desktop only, `hover: hover` + `pointer: fine`) grows it in place, in one
 * continuous 650ms transition, to `min(88vw, 88svh)` on its long side; the
 * sibling card fades to 45% opacity and stays put. Leaving reverses that in
 * 450ms. A click (or Enter/Space, or a tap on mobile) animates once to a
 * full-screen dialog in 550ms, from wherever the card currently is; a second
 * activation, Escape, or a backdrop click returns it in 450ms. Every moving
 * property (transform, opacity, filter, box-shadow) shares one transition per
 * element - no stepped intermediate sizes.
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

  const [mode, setMode] = useState<Mode>('rest')
  const [direction, setDirection] = useState<Direction>('in')
  const [readScale, setReadScale] = useState(1)
  const [flipFrom, setFlipFrom] = useState<string | null>(null)
  const [suppressTransition, setSuppressTransition] = useState(false)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const intentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modeRef = useRef<Mode>(mode)
  const flipRafRef = useRef<number | null>(null)

  const isActive = mode !== 'rest'
  const isSiblingReceding = group !== null && group.activeId !== null && group.activeId !== id

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const clearIntentTimer = useCallback(() => {
    if (intentTimerRef.current) {
      clearTimeout(intentTimerRef.current)
      intentTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isActive) group?.setActiveId(id)
    else if (group?.activeId === id) group?.setActiveId(null)
  }, [isActive, id, group])

  useEffect(() => () => clearIntentTimer(), [clearIntentTimer])

  // Once the full dialog mounts at its FLIP start position, release it to the
  // identity transform on the next frame so it animates in.
  useEffect(() => {
    if (mode !== 'full' || !suppressTransition) return
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
  }, [mode, suppressTransition])

  const close = useCallback(() => {
    clearIntentTimer()
    setDirection('out')
    if (reducedMotion) {
      setMode('rest')
      setFlipFrom(null)
      triggerRef.current?.focus()
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setFlipFrom(flipTransformFor(rect))
  }, [reducedMotion, clearIntentTimer])

  const handleClick = useCallback(() => {
    if (mode === 'full') {
      close()
      return
    }
    clearIntentTimer()
    setDirection('in')
    if (reducedMotion) {
      setMode('full')
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      setFlipFrom(flipTransformFor(rect))
      setSuppressTransition(true)
    }
    setMode('full')
  }, [mode, reducedMotion, close, clearIntentTimer])

  const handleMouseEnter = useCallback(() => {
    if (mobile || mode !== 'rest' || reducedMotion) return
    if (document.visibilityState === 'hidden') return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    intentTimerRef.current = setTimeout(() => {
      if (modeRef.current !== 'rest') return
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) setReadScale(readScaleFor(rect))
      setDirection('in')
      setMode('read')
    }, HOVER_INTENT_MS)
  }, [mobile, mode, reducedMotion])

  const handleMouseLeave = useCallback(() => {
    clearIntentTimer()
    if (mode === 'read') {
      setDirection('out')
      setMode('rest')
    }
  }, [mode, clearIntentTimer])

  useEffect(() => {
    if (mode !== 'full') return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, close])

  useEffect(() => {
    if (mode === 'full') closeButtonRef.current?.focus()
  }, [mode])

  const scale = reducedMotion ? 1 : mode === 'read' ? readScale : 1
  const veil = mode === 'full' ? 0.38 : 0

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        aria-label={label}
        aria-expanded={isActive}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'hero-card relative block overflow-hidden rounded-lg border border-border/60 bg-card',
          className ?? 'aspect-square h-[50.4svh] max-h-[528px]'
        )}
        style={{
          transform: mode === 'full' ? 'none' : `scale(${scale})`,
          transformOrigin: 'center',
          zIndex: isActive ? 20 : 0,
          opacity: isSiblingReceding ? 0.45 : 1,
          boxShadow: mode === 'rest' ? SHADOW_REST : SHADOW_GROWN,
          transition: mode === 'full' ? 'none' : cardTransition(direction, mode, reducedMotion),
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

      {mode === 'full' &&
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
                backgroundColor: `oklch(0.2 0.01 48 / ${veil * 100}%)`,
                filter: `blur(${veil > 0 ? 12 : 0}px)`,
                transition: backdropTransition(direction, reducedMotion),
              }}
            />
            <div
              className='relative h-[min(100svh,100vw)] w-[min(100svh,100vw)] overflow-hidden rounded-xl bg-card'
              style={{
                transform: flipFrom ?? IDENTITY_TRANSFORM,
                transformOrigin: 'center',
                boxShadow: SHADOW_GROWN,
                transition: suppressTransition
                  ? 'none'
                  : cardTransition(direction, mode, reducedMotion),
              }}
              onTransitionEnd={(event) => {
                if (event.target !== event.currentTarget) return
                if (event.propertyName !== 'transform') return
                if (direction !== 'out' || mode !== 'full') return
                setMode('rest')
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
