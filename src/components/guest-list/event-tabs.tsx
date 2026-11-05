import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Event } from '~/app/utils/shared-types'
import { useToggleEventForm } from '~/components/contexts/event-form-context'
import { Button } from '~/components/ui/button'

type EventsTabsProps = {
  events: Event[]
  selectedEventId: string
}

export default function EventsTabs({ events, selectedEventId }: EventsTabsProps) {
  const toggleEventForm = useToggleEventForm()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState(false)

  const scrollActiveTabIntoView = useCallback((node: HTMLLIElement | null) => {
    node?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const updateOverflow = () => setHasOverflow(scroller.scrollWidth > scroller.clientWidth + 1)
    updateOverflow()

    const observer = new ResizeObserver(updateOverflow)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div className='relative -mx-4 lg:-mx-6'>
        <div
          ref={scrollerRef}
          className='scrollbar-thin overflow-x-auto overscroll-x-contain scroll-smooth px-4 lg:px-6'
        >
          <ul className='flex w-max min-w-full snap-x snap-mandatory items-center gap-5'>
            <li
              ref={selectedEventId === 'all' ? scrollActiveTabIntoView : undefined}
              className={`shrink-0 cursor-pointer whitespace-nowrap border-b-2 py-3 text-sm transition-colors hover:border-foreground ${
                selectedEventId === 'all'
                  ? 'border-foreground font-medium'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              <Link href='?event=all' scroll={false}>
                כל האירועים
              </Link>
            </li>
            {events?.map((event) => {
              return (
                <li
                  ref={selectedEventId === event.id ? scrollActiveTabIntoView : undefined}
                  className={`shrink-0 cursor-pointer whitespace-nowrap border-b-2 py-3 text-sm transition-colors hover:border-foreground ${
                    selectedEventId === event.id
                      ? 'border-foreground font-medium'
                      : 'border-transparent text-muted-foreground'
                  }`}
                  key={event.id}
                >
                  <Link href={`?event=${event.id}`} scroll={false}>
                    {event.name}
                  </Link>
                </li>
              )
            })}
            <li className='shrink-0'>
              <Button
                variant='ghost'
                size='sm'
                className='whitespace-nowrap text-primary'
                onClick={() => toggleEventForm()}
              >
                + אירוע חדש
              </Button>
            </li>
          </ul>
        </div>
        {hasOverflow ? (
          <div
            aria-hidden='true'
            className='pointer-events-none absolute inset-y-0 end-0 flex w-10 items-center justify-end bg-gradient-to-s from-background via-background/90 to-transparent pe-2'
          >
            <svg
              className='h-4 w-4 text-muted-foreground'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
              strokeWidth={1.5}
            >
              <title>אירועים נוספים</title>
              <path strokeLinecap='round' strokeLinejoin='round' d='M15.75 19.5 8.25 12l7.5-7.5' />
            </svg>
          </div>
        ) : null}
      </div>
      <div className='border-border border-t' />
    </>
  )
}
