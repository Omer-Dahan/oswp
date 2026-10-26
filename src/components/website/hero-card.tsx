'use client'

import { X } from 'lucide-react'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '~/lib/utils'

type Level = 0 | 1 | 2 | 3
type Direction = 'in' | 'out'

const DWELL_MS = 3000
const STEP_MS = 320
const STEP_GAP_MS = 120
const EXIT_MS = 170

const SCALE_BY_LEVEL: Record<Level, number> = { 0: 1, 1: 1.4, 2: 1.9, 3: 1 }
const LIFT_BY_LEVEL: Record<Level, number> = { 0: 0, 1: -6, 2: -10, 3: 0 }
const BLUR_BY_LEVEL: Record<Level, number> = { 0: 0, 1: 6, 2: 10, 3: 14 }
const VEIL_BY_LEVEL: Record<Level, number> = { 0: 0, 1: 0.18, 2: 0.28, 3: 0.38 }
const BACKDROP_SCALE_BY_LEVEL: Record<Level, number> = { 0: 1, 1: 1.02, 2: 1.04, 3: 1.04 }

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

function cardTransition(direction: Direction, reducedMotion: boolean): string {
  if (reducedMotion) return 'none'
  if (direction === 'out') {
    return 'transform 170ms ease-out, box-shadow 170ms ease-out'
  }
  return [
    'transform 260ms cubic-bezier(0.34, 1.32, 0.64, 1)',
    'box-shadow 300ms cubic-bezier(0.34, 1.32, 0.64, 1) 40ms',
  ].join(', ')
}

function backdropTransition(direction: Direction, reducedMotion: boolean): string {
  if (reducedMotion) return 'none'
  if (direction === 'out') {
    return 'background-color 170ms ease-out, filter 170ms ease-out, transform 170ms ease-out'
  }
  return [
    'background-color 260ms cubic-bezier(0.34, 1.32, 0.64, 1)',
    'filter 260ms cubic-bezier(0.34, 1.32, 0.64, 1) 80ms',
    'transform 260ms cubic-bezier(0.34, 1.32, 0.64, 1)',
  ].join(', ')
}

type Rect = { top: number; left: number; width: number; height: number }

/** The viewport-filling square the full level settles into: `min(100svh, 100vw)`, centred. */
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
  /**
   * Below `md`: no dwell timer, no stepped zoom, no FLIP animation. A tap
   * jumps straight to the full-screen overlay with an instant (or at most
   * 120ms opacity) change instead of climbing through the hover levels.
   */
  mobile?: boolean
}

const MOBILE_OVERLAY_TRANSITION = 'opacity 120ms ease'

/**
 * One of the home's interactive cards. Click/Enter/Space steps it through
 * 1.0 -> 1.4 -> 1.9 -> full screen, with the backdrop blurring and darkening
 * a little more at each step; a further activation at full closes it back
 * down. Resting the pointer on it for 3s (desktop only) runs the same climb
 * on its own. Shared by the desktop side-by-side layout and the mobile
 * stacked layout.
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

  const [level, setLevel] = useState<Level>(0)
  const [direction, setDirection] = useState<Direction>('in')
  const [isDwelling, setIsDwelling] = useState(false)
  const [flipFrom, setFlipFrom] = useState<string | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sequenceTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flipRafRef = useRef<number | null>(null)

  const isActive = level > 0
  const isSiblingReceding = group !== null && group.activeId !== null && group.activeId !== id

  const clearSequenceTimers = useCallback(() => {
    sequenceTimersRef.current.forEach(clearTimeout)
    sequenceTimersRef.current = []
  }, [])

  const clearDwellTimer = useCallback(() => {
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current)
      dwellTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isActive) group?.setActiveId(id)
    else if (group?.activeId === id) group?.setActiveId(null)
  }, [isActive, id, group])

  useEffect(
    () => () => {
      clearDwellTimer()
      clearSequenceTimers()
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    },
    [clearDwellTimer, clearSequenceTimers]
  )

  const goToLevel = useCallback(
    (next: Level) => {
      if (next === 3 && !mobile) {
        const rect = triggerRef.current?.getBoundingClientRect()
        if (rect) setFlipFrom(flipTransformFor(rect))
      }
      setLevel(next)
    },
    [mobile]
  )

  // Once the full overlay mounts at its FLIP start position, release it to
  // the identity transform on the next frame so it animates in.
  useEffect(() => {
    if (level !== 3 || flipFrom === null) return
    const raf1 = requestAnimationFrame(() => {
      flipRafRef.current = requestAnimationFrame(() => setFlipFrom(null))
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (flipRafRef.current !== null) cancelAnimationFrame(flipRafRef.current)
    }
  }, [level, flipFrom])

  const close = useCallback(() => {
    clearDwellTimer()
    clearSequenceTimers()
    setIsDwelling(false)
    setDirection('out')

    if (level === 3 && !mobile) {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) setFlipFrom(flipTransformFor(rect))
    }

    closeTimerRef.current = setTimeout(
      () => {
        setLevel(0)
        setFlipFrom(null)
        triggerRef.current?.focus()
      },
      reducedMotion || mobile ? 0 : EXIT_MS
    )
  }, [level, reducedMotion, mobile, clearDwellTimer, clearSequenceTimers])

  const startDwellSequence = useCallback(() => {
    setIsDwelling(true)
    setDirection('in')
    goToLevel(1)
    const t1 = setTimeout(() => {
      setDirection('in')
      goToLevel(2)
    }, STEP_MS + STEP_GAP_MS)
    const t2 = setTimeout(
      () => {
        setDirection('in')
        goToLevel(3)
        setIsDwelling(false)
      },
      2 * (STEP_MS + STEP_GAP_MS)
    )
    sequenceTimersRef.current.push(t1, t2)
  }, [goToLevel])

  const handleClick = useCallback(() => {
    if (mobile) {
      if (level === 3) {
        close()
        return
      }
      setDirection('in')
      goToLevel(3)
      return
    }
    if (isDwelling) {
      clearSequenceTimers()
      setIsDwelling(false)
      setDirection('in')
      goToLevel(3)
      return
    }
    if (level === 3) {
      close()
      return
    }
    setDirection('in')
    goToLevel((level + 1) as Level)
  }, [mobile, isDwelling, level, goToLevel, close, clearSequenceTimers])

  const handleMouseEnter = useCallback(() => {
    if (mobile || level !== 0 || reducedMotion) return
    if (document.visibilityState === 'hidden') return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    dwellTimerRef.current = setTimeout(startDwellSequence, DWELL_MS)
  }, [mobile, level, reducedMotion, startDwellSequence])

  const handleMouseLeave = useCallback(() => {
    clearDwellTimer()
    if (isDwelling) {
      clearSequenceTimers()
      setIsDwelling(false)
      setDirection('out')
      setLevel(0)
    }
  }, [isDwelling, clearDwellTimer, clearSequenceTimers])

  useEffect(() => {
    if (!isActive) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isActive, close])

  useEffect(() => {
    if (level === 3) closeButtonRef.current?.focus()
  }, [level])

  const scale = reducedMotion ? 1 : SCALE_BY_LEVEL[level]
  const lift = reducedMotion ? 0 : LIFT_BY_LEVEL[level]
  const blur = reducedMotion ? 0 : BLUR_BY_LEVEL[level]
  const backdropScale = reducedMotion ? 1 : BACKDROP_SCALE_BY_LEVEL[level]
  const veil = VEIL_BY_LEVEL[level]

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
          transform: level === 3 ? 'none' : `translateY(${lift}px) scale(${scale})`,
          transformOrigin: 'center',
          zIndex: isActive ? 20 : 0,
          opacity: isSiblingReceding ? 0.6 : isActive ? 0.92 : 1,
          boxShadow:
            level === 0
              ? '0 12px 32px rgba(46,38,32,.12)'
              : level === 1
                ? '0 20px 50px rgba(46,38,32,.18)'
                : '0 40px 90px rgba(46,38,32,.28)',
          transition: mobile
            ? MOBILE_OVERLAY_TRANSITION
            : [
                cardTransition(direction, reducedMotion),
                reducedMotion ? 'none' : 'opacity 200ms ease',
              ].join(', '),
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

      {level === 3 &&
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
                filter: `blur(${blur}px)`,
                transform: `scale(${backdropScale})`,
                transition: mobile
                  ? MOBILE_OVERLAY_TRANSITION
                  : backdropTransition(direction, reducedMotion),
              }}
            />
            <div
              className='relative h-[min(100svh,100vw)] w-[min(100svh,100vw)] overflow-hidden rounded-xl bg-card'
              style={{
                transform: flipFrom ?? IDENTITY_TRANSFORM,
                transformOrigin: 'center',
                boxShadow: '0 40px 90px rgba(46,38,32,.28)',
                transition:
                  flipFrom !== null
                    ? 'none'
                    : mobile
                      ? MOBILE_OVERLAY_TRANSITION
                      : cardTransition(direction, reducedMotion),
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
