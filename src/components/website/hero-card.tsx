'use client'

import { X } from 'lucide-react'
import Image from 'next/image'
import { useRef, useState } from 'react'

type HeroCardProps = {
  src: string
  /** Accessible name for the card's trigger button and the expanded dialog. */
  label: string
  /** Set on the expanded image only; the card thumbnail stays decorative. */
  expandedAlt: string
  priority?: boolean
}

/**
 * One of the two desktop home cards: a clickable thumbnail that opens the
 * same artwork large in a native <dialog>, which already gives us
 * Escape-to-close and return-focus-to-trigger for free.
 */
export function HeroCard({ src, label, expandedAlt, priority }: Readonly<HeroCardProps>) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  const openDialog = () => {
    dialogRef.current?.showModal()
    setIsOpen(true)
  }

  const closeDialog = () => {
    dialogRef.current?.close()
  }

  return (
    <>
      <button
        type='button'
        aria-label={label}
        aria-expanded={isOpen}
        onClick={openDialog}
        className='hero-card relative aspect-square h-[42svh] max-h-[440px] overflow-hidden rounded-lg border border-border/60 bg-card shadow-md'
      >
        <Image
          src={src}
          alt=''
          aria-hidden
          fill
          priority={priority}
          sizes='(min-width: 768px) 40vw, 90vw'
          className='object-cover'
        />
      </button>

      <dialog
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-label={label}
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDialog()
        }}
        className='hero-dialog m-auto size-[min(92vw,92svh)] overflow-hidden rounded-xl border border-border/60 bg-transparent p-0 backdrop:bg-transparent'
      >
        <div className='relative size-full'>
          <Image src={src} alt={expandedAlt} fill sizes='92vw' className='object-contain' />
          <button
            type='button'
            onClick={closeDialog}
            aria-label='סגירה'
            className='absolute end-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition duration-150 ease-out hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]'
          >
            <X className='size-4' aria-hidden />
          </button>
        </div>
      </dialog>
    </>
  )
}
