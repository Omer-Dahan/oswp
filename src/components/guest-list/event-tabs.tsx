import Link from 'next/link'
import type { Event } from '~/app/utils/shared-types'
import { useToggleEventForm } from '~/components/contexts/event-form-context'
import { Button } from '~/components/ui/button'

type EventsTabsProps = {
  events: Event[]
  selectedEventId: string
}

export default function EventsTabs({ events, selectedEventId }: EventsTabsProps) {
  const toggleEventForm = useToggleEventForm()

  return (
    <>
      <div className='-mx-4 overflow-x-auto overscroll-x-contain px-4 lg:-mx-6 lg:px-6'>
        <ul className='flex w-max min-w-full items-center gap-5'>
          <li
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
      <div className='border-border border-t' />
    </>
  )
}
