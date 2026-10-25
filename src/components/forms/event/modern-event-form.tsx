'use client'

/**
 * Modern Event Form
 *
 * Create/update event form using react-hook-form + Zod + shadcn.
 * Follows CLAUDE.md patterns for form handling.
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { Calendar as CalendarIcon, Clock } from 'lucide-react'
import { useEffect } from 'react'
import { type Resolver, type SubmitHandler, useForm } from 'react-hook-form'

import {
  type EventFormData,
  EventFormSchema,
  getEventFormDefaults,
} from '~/components/forms/event/event-form.schema'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Switch } from '~/components/ui/switch'
import { Textarea } from '~/components/ui/textarea'
import { cn } from '~/lib/utils'
import type { Event } from '~/server/domains/event/event.types'

type ModernEventFormBaseProps = Readonly<{
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: EventFormData) => Promise<void> | void
  isSubmitting?: boolean
}>

type ModernEventFormProps =
  | (ModernEventFormBaseProps & {
      mode: 'create'
      event?: never
    })
  | (ModernEventFormBaseProps & {
      mode: 'edit'
      event: Event
    })

export function ModernEventForm({
  mode,
  open,
  onOpenChange,
  onSubmit,
  event,
  isSubmitting = false,
}: ModernEventFormProps) {
  const isEditMode = mode === 'edit'

  // Initialize form with defaults or event data
  const form = useForm<EventFormData>({
    resolver: zodResolver(EventFormSchema) as Resolver<EventFormData>,
    defaultValues: isEditMode
      ? {
          eventName: event.name,
          date: event.date ? format(new Date(event.date), 'yyyy-MM-dd') : '',
          startTime: event.startTime ?? '',
          endTime: event.endTime ?? '',
          venue: event.venue ?? '',
          venueAddress: event.venueAddress ?? '',
          venueWazeUrl: event.venueWazeUrl ?? '',
          attire: event.attire ?? '',
          description: event.description ?? '',
          collectRsvp: event.collectRsvp ?? false,
          allowTagAlongs: event.allowTagAlongs ?? false,
        }
      : getEventFormDefaults(),
  })

  const { register, handleSubmit, formState, setValue, watch } = form
  const { errors, isDirty } = formState
  const dateValue = watch('date')

  const handleFormSubmit: SubmitHandler<EventFormData> = async (data) => {
    await onSubmit(data)
    // Don't close here - let parent's onSuccess handle closing
    // This ensures data is refetched before dialog closes
  }

  // Reset form when dialog opens or event changes
  useEffect(() => {
    if (open) {
      // When dialog opens, reset to event data or defaults
      form.reset(
        isEditMode
          ? {
              eventName: event.name,
              date: event.date ? format(new Date(event.date), 'yyyy-MM-dd') : '',
              startTime: event.startTime ?? '',
              endTime: event.endTime ?? '',
              venue: event.venue ?? '',
              venueAddress: event.venueAddress ?? '',
              venueWazeUrl: event.venueWazeUrl ?? '',
              attire: event.attire ?? '',
              description: event.description ?? '',
              collectRsvp: event.collectRsvp ?? false,
              allowTagAlongs: event.allowTagAlongs ?? false,
            }
          : getEventFormDefaults()
      )
    }
  }, [open, event, form, isEditMode])

  // Parse date string to Date object for calendar
  const selectedDate = dateValue ? new Date(dateValue) : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle className='text-xl md:text-2xl'>
            {isEditMode ? 'עריכת אירוע' : 'יצירת אירוע'}
          </DialogTitle>
          <DialogDescription className='text-sm'>
            {isEditMode
              ? 'עדכנו את הפרטים של אירוע החתונה שלכם.'
              : 'הוסיפו אירוע חדש כמו טקס, קבלת פנים או ארוחת חזרה.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className='space-y-4 md:space-y-6'>
          {/* Event Name */}
          <div className='space-y-2'>
            <Label htmlFor='eventName' className='text-sm md:text-base'>
              שם האירוע <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='eventName'
              {...register('eventName')}
              placeholder='למשל, טקס חתונה'
              disabled={isSubmitting}
              className={cn(errors.eventName && 'border-destructive')}
            />
            {errors.eventName && (
              <p className='text-destructive text-xs md:text-sm'>{errors.eventName.message}</p>
            )}
          </div>

          {/* Date */}
          <div className='space-y-2'>
            <Label htmlFor='date' className='text-sm md:text-base'>
              תאריך
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant='outline'
                  className={cn(
                    'w-full justify-start text-start font-normal',
                    !selectedDate && 'text-muted-foreground'
                  )}
                  disabled={isSubmitting}
                >
                  <CalendarIcon className='me-2 h-4 w-4' />
                  {selectedDate ? (
                    format(selectedDate, 'd בMMMM yyyy', { locale: he })
                  ) : (
                    <span className='text-xs md:text-sm'>בחרו תאריך</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-auto p-0' align='start'>
                <Calendar
                  mode='single'
                  selected={selectedDate}
                  onSelect={(date) => {
                    setValue('date', date ? format(date, 'yyyy-MM-dd') : '', {
                      shouldDirty: true,
                    })
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {errors.date && (
              <p className='text-destructive text-xs md:text-sm'>{errors.date.message}</p>
            )}
          </div>

          {/* Time Range */}
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='startTime' className='text-sm md:text-base'>
                שעת התחלה
              </Label>
              <div className='relative'>
                <Clock className='pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  id='startTime'
                  type='time'
                  {...register('startTime')}
                  disabled={isSubmitting}
                  className='ps-10'
                />
              </div>
              {errors.startTime && (
                <p className='text-destructive text-xs md:text-sm'>{errors.startTime.message}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='endTime' className='text-sm md:text-base'>
                שעת סיום
              </Label>
              <div className='relative'>
                <Clock className='pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  id='endTime'
                  type='time'
                  {...register('endTime')}
                  disabled={isSubmitting}
                  className='ps-10'
                />
              </div>
              {errors.endTime && (
                <p className='text-destructive text-xs md:text-sm'>{errors.endTime.message}</p>
              )}
            </div>
          </div>

          {/* Venue */}
          <div className='space-y-2'>
            <Label htmlFor='venue' className='text-sm md:text-base'>
              מקום
            </Label>
            <Input
              id='venue'
              {...register('venue')}
              placeholder='לדוגמה: אולמי הגן'
              disabled={isSubmitting}
              className={cn(errors.venue && 'border-destructive')}
            />
            {errors.venue && (
              <p className='text-destructive text-xs md:text-sm'>{errors.venue.message}</p>
            )}
          </div>

          {/* Venue Address */}
          <div className='space-y-2'>
            <Label htmlFor='venueAddress' className='text-sm md:text-base'>
              כתובת האולם
            </Label>
            <Input
              id='venueAddress'
              {...register('venueAddress')}
              placeholder='לדוגמה: אגדתא אולם אירועים, צומת ראם, מסמיה'
              disabled={isSubmitting}
              className={cn(errors.venueAddress && 'border-destructive')}
            />
            {errors.venueAddress && (
              <p className='text-destructive text-xs md:text-sm'>{errors.venueAddress.message}</p>
            )}
          </div>

          {/* Venue Waze Link */}
          <div className='space-y-2'>
            <Label htmlFor='venueWazeUrl' className='text-sm md:text-base'>
              קישור וויז
            </Label>
            <Input
              id='venueWazeUrl'
              {...register('venueWazeUrl')}
              placeholder='https://waze.com/ul/...'
              disabled={isSubmitting}
              className={cn(errors.venueWazeUrl && 'border-destructive')}
            />
            <p className='text-muted-foreground text-xs'>
              פתחו את האולם בוויז ← שתפו ← הדביקו את הקישור
            </p>
            {errors.venueWazeUrl && (
              <p className='text-destructive text-xs md:text-sm'>{errors.venueWazeUrl.message}</p>
            )}
          </div>

          {/* Attire */}
          <div className='space-y-2'>
            <Label htmlFor='attire' className='text-sm md:text-base'>
              קוד לבוש
            </Label>
            <Input
              id='attire'
              {...register('attire')}
              placeholder='למשל, עניבה שחורה, לבוש קוקטייל'
              disabled={isSubmitting}
              className={cn(errors.attire && 'border-destructive')}
            />
            {errors.attire && (
              <p className='text-destructive text-xs md:text-sm'>{errors.attire.message}</p>
            )}
          </div>

          {/* Description */}
          <div className='space-y-2'>
            <Label htmlFor='description' className='text-sm md:text-base'>
              תיאור
            </Label>
            <Textarea
              id='description'
              {...register('description')}
              placeholder='הוסיפו פרטים נוספים על האירוע...'
              rows={3}
              disabled={isSubmitting}
              className={cn(errors.description && 'border-destructive', 'resize-none')}
            />
            {errors.description && (
              <p className='text-destructive text-xs md:text-sm'>{errors.description.message}</p>
            )}
          </div>

          {/* Collect RSVPs */}
          <div className='flex items-center justify-between rounded-lg border bg-muted/50 p-4'>
            <div className='space-y-0.5'>
              <Label htmlFor='collectRsvp' className='text-sm md:text-base'>
                איסוף אישורי הגעה
              </Label>
              <p className='text-muted-foreground text-xs'>
                הפעילו כדי להציג את האירוע הזה בתהליך אישור ההגעה הציבורי
              </p>
            </div>
            <Switch
              id='collectRsvp'
              checked={watch('collectRsvp') ?? false}
              onCheckedChange={(checked) => {
                setValue('collectRsvp', checked, { shouldDirty: true })
              }}
              disabled={isSubmitting}
            />
          </div>
          {/* Allow Tag-Alongs */}
          <div className='flex items-center justify-between rounded-lg border bg-muted/50 p-4'>
            <div className='space-y-0.5'>
              <Label htmlFor='allowTagAlongs' className='text-sm md:text-base'>
                אפשרו מצטרפים
              </Label>
              <p className='text-muted-foreground text-xs'>
                מצטרפים יכולים להיות מוזמנים ולאשר הגעה לאירוע הזה
              </p>
            </div>
            <Switch
              id='allowTagAlongs'
              checked={watch('allowTagAlongs') ?? false}
              onCheckedChange={(checked) => {
                setValue('allowTagAlongs', checked, { shouldDirty: true })
              }}
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter className='gap-2 sm:gap-0'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className='text-xs md:text-sm'
            >
              ביטול
            </Button>
            <Button
              type='submit'
              disabled={isSubmitting || !isDirty}
              className='text-xs md:text-sm'
            >
              {isSubmitting ? 'שומר...' : isEditMode ? 'עדכון אירוע' : 'יצירת אירוע'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
