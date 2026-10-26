'use client'

import { X } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Total length of the reveal: backdrop fade, flap open, card rise, envelope fade-out. */
const SEQUENCE_MS = 1100

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

type SaveTheDateActionProps = {
  invitationAlt: string
  className: string
}

/**
 * The home's quiet "שמרו את התאריך" action: opens a full-screen envelope
 * reveal over the current page (no navigation — visiting the real
 * `/save-the-date` page directly is unaffected) that lets the couple's
 * invitation rise out of a closed envelope in one continuous motion.
 */
export function SaveTheDateAction({ invitationAlt, className }: Readonly<SaveTheDateActionProps>) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  return (
    <>
      <button ref={triggerRef} type='button' onClick={() => setOpen(true)} className={className}>
        שמרו את התאריך
      </button>
      {open ? <SaveTheDateOverlay onClose={close} invitationAlt={invitationAlt} /> : null}
    </>
  )
}

function SaveTheDateOverlay({
  onClose,
  invitationAlt,
}: Readonly<{ onClose: () => void; invitationAlt: string }>) {
  const reducedMotion = usePrefersReducedMotion()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [settled, setSettled] = useState(reducedMotion)

  useEffect(() => {
    if (reducedMotion) {
      setSettled(true)
      return
    }
    const timer = window.setTimeout(() => setSettled(true), SEQUENCE_MS)
    return () => window.clearTimeout(timer)
  }, [reducedMotion])

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // A click anywhere completes the sequence immediately; once settled, only
  // the backdrop itself (not the card) closes the overlay.
  const handleStageClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!settled) {
        setSettled(true)
        return
      }
      if ((event.target as HTMLElement).dataset.stdBackdrop === 'true') onClose()
    },
    [settled, onClose]
  )

  const showEnvelope = !settled && !reducedMotion

  return createPortal(
    <div
      className='fixed inset-0 z-50'
      role='dialog'
      aria-modal='true'
      aria-label='שמרו את התאריך'
      onClick={handleStageClick}
      onKeyDown={(event) => {
        if (event.key === 'Tab') {
          event.preventDefault()
          closeButtonRef.current?.focus()
        }
      }}
    >
      <div
        data-std-backdrop='true'
        className={`absolute inset-0 overflow-hidden ${reducedMotion ? '' : 'std-reveal-backdrop'}`}
      >
        <Image
          src='/brand/linen-bg-portrait.png'
          alt=''
          aria-hidden
          fill
          sizes='100vw'
          className='object-cover object-center blur-[10px] md:hidden'
        />
        <Image
          src='/brand/linen-bg.png'
          alt=''
          aria-hidden
          fill
          sizes='100vw'
          className='hidden object-cover object-center blur-[10px] md:block'
        />
        <div className='absolute inset-0 bg-background/55' />
      </div>

      <button
        ref={closeButtonRef}
        type='button'
        onClick={onClose}
        aria-label='סגירה'
        className='absolute end-3 top-3 z-10 inline-flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition duration-150 ease-out hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]'
      >
        <X className='size-4' aria-hidden />
      </button>

      <div className='absolute inset-0 grid place-items-center'>
        {showEnvelope ? (
          <div
            className='std-reveal-envelope relative z-0'
            style={{ width: '300px', height: '196px', perspective: '1200px' }}
          >
            <div
              className='absolute inset-0 rounded-sm'
              style={{ background: '#f6f1e7', border: '1px solid rgba(46,38,32,.18)' }}
            />
            <div
              className='absolute rounded-[2px]'
              style={{ inset: '8px', border: '1px dashed rgba(46,38,32,.15)' }}
            />
            <div
              className='std-reveal-flap absolute inset-x-0 top-0'
              style={{
                height: '55%',
                clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                background: '#fbf7ee',
                border: '1px solid rgba(46,38,32,.18)',
                transformOrigin: 'top center',
                backfaceVisibility: 'hidden',
              }}
            />
          </div>
        ) : null}

        <div
          className={`relative z-10 ${settled ? '' : 'std-reveal-card'}`}
          style={{ width: 'min(88vw, 88svh)', height: 'min(88vw, 88svh)' }}
        >
          <div
            aria-hidden
            className='absolute'
            style={{
              inset: '-17.5%',
              background:
                'radial-gradient(closest-side, #ffffff 0%, #ffffff 46%, rgba(255,255,255,0) 100%)',
            }}
          />
          <div className='absolute inset-0' style={{ boxShadow: '0 30px 70px rgba(46,38,32,.28)' }}>
            <Image src='/brand/invitation-v2.png' alt={invitationAlt} fill sizes='88vw' className='object-contain' />
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
