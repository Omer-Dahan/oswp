'use client'

import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { AiOutlineCalendar } from 'react-icons/ai'
import { IoIosCheckmarkCircleOutline } from 'react-icons/io'
import { formatDateStandard } from '~/app/utils/helpers'
import type { Event, Guest, RsvpFormResponse, StepFormProps } from '~/app/utils/shared-types'
import { useRsvpForm, useUpdateRsvpForm } from '~/components/contexts/rsvp-form-context'
import { upsertRsvpResponses } from '~/components/website/forms/rsvp-state'
import { isChuppahEventName } from '~/lib/wedding/rsvp-events'
import {
  StepActions,
  StepHeading,
  StepPrimaryButton,
  StepSecondaryButton,
  StepShell,
} from '~/components/website/forms/steps/step-ui'

export type CombinedRsvpEntry = {
  event: Event
  invitedGuests: Guest[]
}

type CombinedEventRsvpFormProps = StepFormProps & {
  entries: CombinedRsvpEntry[]
}

/** "19:30–20:30" when both ends are known, otherwise whatever we have. */
function timeRangeLabel(event: Event): string {
  if (event.startTime && event.endTime) return `${event.startTime}–${event.endTime}`
  return event.startTime ?? event.endTime ?? ''
}

const toMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

const toClock = (minutes: number): string => {
  const wrapped = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

/**
 * The evening as a whole: earliest start to latest end across the events. Ends
 * after midnight count as the next day, so 00:30 is later than 20:30 even
 * though it sorts earlier as a string.
 */
function fullEveningLabel(entries: CombinedRsvpEntry[]): string {
  const starts = entries.map((entry) => entry.event.startTime).filter(Boolean) as string[]
  const ends = entries.map((entry) => entry.event.endTime).filter(Boolean) as string[]
  if (starts.length === 0) return ''
  const earliest = Math.min(...starts.map(toMinutes))
  const latest = ends.length
    ? Math.max(...ends.map((end) => (toMinutes(end) < earliest ? toMinutes(end) + 1440 : toMinutes(end))))
    : earliest
  return latest !== earliest ? `${toClock(earliest)}–${toClock(latest)}` : toClock(earliest)
}

const responseKey = (eventId: string, guestId: number) => `${eventId}:${guestId}`

/**
 * One screen for every RSVP-able event instead of one screen per event: a guest
 * invited to the chuppah and the wedding sees both rows side by side, so the
 * evening reads as a single invitation rather than two unrelated forms.
 */
export default function CombinedEventRsvpForm({
  goNext,
  goBack,
  entries,
}: CombinedEventRsvpFormProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('rsvp')
  const rsvpFormData = useRsvpForm()
  const updateRsvpForm = useUpdateRsvpForm()

  const initialResponses = useMemo(() => {
    const map: Record<string, RsvpFormResponse> = {}
    for (const response of rsvpFormData.rsvpResponses) {
      map[responseKey(response.eventId, response.guestId)] = response
    }
    return map
  }, [rsvpFormData.rsvpResponses])

  const [responsesByKey, setResponsesByKey] = useState<Record<string, RsvpFormResponse>>(initialResponses)

  // A guest who comes to the wedding comes to the chuppah that same evening, so
  // confirming the meal pre-fills the chuppah row instead of asking twice.
  const chuppahEventId = useMemo(
    () => entries.find((entry) => isChuppahEventName(entry.event.name))?.event.id ?? null,
    [entries]
  )
  const mealEventId = useMemo(
    () => entries.find((entry) => !isChuppahEventName(entry.event.name))?.event.id ?? null,
    [entries]
  )

  const guests = useMemo(() => {
    const byId = new Map<number, Guest>()
    for (const entry of entries) {
      for (const guest of entry.invitedGuests) byId.set(guest.id, guest)
    }
    return [...byId.values()]
  }, [entries])

  const hasAnsweredEverything = guests.every((guest) =>
    entries.every((entry) => {
      const invited = entry.invitedGuests.some((candidate) => candidate.id === guest.id)
      if (!invited) return true
      return responsesByKey[responseKey(entry.event.id, guest.id)] !== undefined
    })
  )

  const eventDate = entries.find((entry) => entry.event.date)?.event.date
  const evening = fullEveningLabel(entries)

  return (
    <StepShell>
      <StepHeading>{t('eventsTitle')}</StepHeading>
      {!!eventDate && (
        <div className='flex items-center gap-2 text-base text-muted-foreground'>
          <AiOutlineCalendar size={20} aria-hidden />
          <span>
            {formatDateStandard(eventDate, 'he')}
            {evening && ` · ${evening}`}
          </span>
        </div>
      )}
      <ul className='flex flex-col gap-3'>
        {guests.map((guest) => (
          <li
            key={guest.id}
            className='flex flex-col gap-3 rounded-[16px] border border-border px-5 py-4'
          >
            <span className='text-base text-foreground'>
              {guest.firstName} {guest.lastName}
            </span>
            {entries.map((entry) => {
              const invited = entry.invitedGuests.some((candidate) => candidate.id === guest.id)
              if (!invited) return null
              const key = responseKey(entry.event.id, guest.id)
              return (
                <div
                  key={entry.event.id}
                  className='flex flex-col gap-2 border-border/60 border-t pt-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between'
                >
                  <span className='text-muted-foreground text-sm'>
                    {entry.event.name}
                    {timeRangeLabel(entry.event) && ` · ${timeRangeLabel(entry.event)}`}
                  </span>
                  <RsvpSelection
                    eventId={entry.event.id}
                    guestId={guest.id}
                    guestName={`${guest.firstName} ${guest.lastName}`}
                    response={responsesByKey[key]}
                    onSelect={(response) =>
                      setResponsesByKey((prev) => {
                        const next = { ...prev, [key]: response }
                        const chuppahKey =
                          chuppahEventId !== null
                            ? responseKey(chuppahEventId, response.guestId)
                            : null
                        if (
                          response.eventId === mealEventId &&
                          response.rsvp === 'Attending' &&
                          chuppahKey !== null &&
                          next[chuppahKey] === undefined
                        ) {
                          next[chuppahKey] = { ...response, eventId: chuppahEventId as string }
                        }
                        return next
                      })
                    }
                  />
                </div>
              )
            })}
          </li>
        ))}
      </ul>
      <StepActions>
        <StepPrimaryButton
          disabled={!hasAnsweredEverything}
          onClick={() => {
            updateRsvpForm({
              rsvpResponses: upsertRsvpResponses(
                rsvpFormData.rsvpResponses,
                Object.values(responsesByKey)
              ),
            })
            goNext?.()
          }}
        >
          {tCommon('continue')}
        </StepPrimaryButton>
        <StepSecondaryButton onClick={() => goBack?.()}>{tCommon('back')}</StepSecondaryButton>
      </StepActions>
    </StepShell>
  )
}

type RsvpSelectionProps = {
  eventId: string
  guestId: number
  guestName: string
  response?: RsvpFormResponse
  onSelect: (response: RsvpFormResponse) => void
}

function RsvpSelection({ eventId, guestId, guestName, response, onSelect }: RsvpSelectionProps) {
  const t = useTranslations('rsvp')
  const selectedRsvp = response?.rsvp
  const handleOnSelect = (selection: 'Attending' | 'Declined') =>
    onSelect({ eventId, guestId, guestName, rsvp: selection })

  return (
    <div className='flex gap-2'>
      <button
        type='button'
        className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border text-base transition-colors sm:w-28 sm:flex-none ${
          selectedRsvp === 'Attending'
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
        }`}
        onClick={() => handleOnSelect('Attending')}
      >
        {selectedRsvp === 'Attending' && <IoIosCheckmarkCircleOutline size={18} aria-hidden />}
        {selectedRsvp === 'Attending' ? t('accepted') : t('accept')}
      </button>
      <button
        type='button'
        className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border text-base transition-colors sm:w-28 sm:flex-none ${
          selectedRsvp === 'Declined'
            ? 'border-foreground/50 bg-foreground/10 text-foreground'
            : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
        }`}
        onClick={() => handleOnSelect('Declined')}
      >
        {selectedRsvp === 'Declined' && <IoIosCheckmarkCircleOutline size={18} aria-hidden />}
        {selectedRsvp === 'Declined' ? t('declined') : t('decline')}
      </button>
    </div>
  )
}
