'use client'

import { useMemo, useState } from 'react'
import { IoArrowDown, IoArrowUp } from 'react-icons/io5'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { normalizeRsvpSteps, RSVP_STEP_KEYS, type RsvpStepKey } from '~/lib/rsvp/steps'
import type { EventWithStats } from '~/server/domains/event/event.types'
import { api } from '~/trpc/react'

const STEP_LABELS: Record<RsvpStepKey, string> = {
  'children-count': 'מספר ילדים',
  'dietary-notes': 'הערות תזונתיות',
  'wishes-message': 'ברכה לזוג',
}

type ManageRsvpPagesDialogProps = Readonly<{
  events: EventWithStats[]
  weddingRsvpSteps: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}>

export function ManageRsvpPagesDialog({
  events,
  weddingRsvpSteps,
  open,
  onOpenChange,
}: ManageRsvpPagesDialogProps) {
  const utils = api.useUtils()
  const initialOrder = useMemo(() => normalizeRsvpSteps(weddingRsvpSteps), [weddingRsvpSteps])
  const [orderedSteps, setOrderedSteps] = useState<RsvpStepKey[]>(() => [
    ...initialOrder,
    ...RSVP_STEP_KEYS.filter((step) => !initialOrder.includes(step)),
  ])
  const [eventSteps, setEventSteps] = useState<Record<string, RsvpStepKey[]>>(() =>
    Object.fromEntries(
      events.map((event) => [
        event.id,
        normalizeRsvpSteps(event.rsvpSteps ?? []).filter((step) => event.rsvpSteps?.includes(step)),
      ])
    )
  )
  const [savingEventId, setSavingEventId] = useState<string | null>(null)

  const updateEventSteps = api.event.updateRsvpSteps.useMutation({
    onSuccess: (updatedEvent) => {
      const savedSteps = updatedEvent.rsvpSteps ?? []
      setSavingEventId(null)
      setEventSteps((current) => ({
        ...current,
        [updatedEvent.id]: normalizeRsvpSteps(savedSteps).filter((step) =>
          savedSteps.includes(step)
        ),
      }))
      utils.event.getAllByUserIdWithStats.setData(undefined, (current) =>
        current?.map((event) =>
          event.id === updatedEvent.id ? { ...event, rsvpSteps: savedSteps } : event
        )
      )
      toast.success('תצוגת הדפים לאירוע נשמרה')
    },
    onError: (error) => {
      setSavingEventId(null)
      toast.error('שמירת תצוגת הדפים נכשלה', { description: error.message })
    },
  })

  const updateWeddingOrder = api.wedding.updateRsvpSteps.useMutation({
    onSuccess: () => toast.success('סדר הדפים נשמר'),
    onError: (error) => toast.error('שמירת סדר הדפים נכשלה', { description: error.message }),
  })

  const toggleEventStep = (eventId: string, step: RsvpStepKey, checked: boolean) => {
    const current = eventSteps[eventId] ?? []
    const next = checked ? [...current, step] : current.filter((value) => value !== step)
    const orderedNext = RSVP_STEP_KEYS.filter((value) => next.includes(value))
    setEventSteps((values) => ({ ...values, [eventId]: orderedNext }))
    setSavingEventId(eventId)
    updateEventSteps.mutate({ eventId, rsvpSteps: orderedNext })
  }

  const moveStep = (index: number, offset: -1 | 1) => {
    setOrderedSteps((current) => {
      const target = index + offset
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target] as RsvpStepKey, next[index] as RsvpStepKey]
      return next
    })
  }

  const rsvpEvents = events.filter((event) => event.collectRsvp)
  const childrenMissing = rsvpEvents.some(
    (event) => !(eventSteps[event.id] ?? []).includes('children-count')
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl' dir='rtl'>
        <DialogHeader>
          <DialogTitle>תצוגת דפים</DialogTitle>
          <DialogDescription>בחרו אילו עמודים יופיעו באישור ההגעה לכל אירוע.</DialogDescription>
        </DialogHeader>

        <div className='space-y-6'>
          <section>
            <h3 className='mb-3 flex items-center gap-2 font-mono text-[0.62rem] text-muted-foreground tracking-wider after:h-px after:flex-1 after:bg-border'>
              דפים לפי אירוע
            </h3>
            <div className='divide-y divide-border rounded-md border'>
              {rsvpEvents.map((event) => {
                const selected = eventSteps[event.id] ?? []
                return (
                  <div className='px-4 py-4' key={event.id}>
                    <div className='flex items-center justify-between gap-3'>
                      <p className='font-medium font-sans text-sm'>{event.name}</p>
                      <p className='font-mono text-[0.62rem] text-muted-foreground'>
                        {selected.filter((step) => orderedSteps.includes(step)).length + 2} עמודים
                      </p>
                    </div>
                    <div className='mt-3 grid gap-3 sm:grid-cols-3'>
                      {RSVP_STEP_KEYS.map((step) => (
                        <div className='flex items-center gap-2 text-sm' key={step}>
                          <Checkbox
                            aria-label={`${STEP_LABELS[step]} עבור ${event.name}`}
                            checked={selected.includes(step)}
                            disabled={savingEventId === event.id}
                            onCheckedChange={(checked) =>
                              toggleEventStep(event.id, step, checked === true)
                            }
                          />
                          <span>{STEP_LABELS[step]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            <h3 className='mb-2 flex items-center gap-2 font-mono text-[0.62rem] text-muted-foreground tracking-wider after:h-px after:flex-1 after:bg-border'>
              סדר הדפים
            </h3>
            <p className='mb-3 text-muted-foreground text-sm'>הסדר הזה משותף לכל האירועים.</p>
            <div className='divide-y divide-border rounded-md border'>
              {orderedSteps.map((step, index) => (
                <div className='flex items-center gap-3 px-4 py-3' key={step}>
                  <span className='flex-1 text-sm'>{STEP_LABELS[step]}</span>
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='h-8 w-8 rounded-sm'
                    aria-label={`העלאת ${STEP_LABELS[step]}`}
                    disabled={index === 0 || updateWeddingOrder.isPending}
                    onClick={() => moveStep(index, -1)}
                  >
                    <IoArrowUp aria-hidden='true' />
                  </Button>
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='h-8 w-8 rounded-sm'
                    aria-label={`הורדת ${STEP_LABELS[step]}`}
                    disabled={index === orderedSteps.length - 1 || updateWeddingOrder.isPending}
                    onClick={() => moveStep(index, 1)}
                  >
                    <IoArrowDown aria-hidden='true' />
                  </Button>
                </div>
              ))}
            </div>
            <div className='mt-3 flex justify-end'>
              <Button
                type='button'
                size='sm'
                disabled={updateWeddingOrder.isPending}
                onClick={() => updateWeddingOrder.mutate({ rsvpSteps: orderedSteps })}
              >
                {updateWeddingOrder.isPending ? 'שומר...' : 'שמירת סדר הדפים'}
              </Button>
            </div>
          </section>

          {childrenMissing ? (
            <p role='alert' className='border-primary/30 border-t pt-3 text-primary text-sm'>
              ללא שאלת מספר הילדים, ספירת מנות הילדים בדוח המטבח תהיה ריקה כאשר אין נתוני גיל
              לאורחים.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            סגירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
