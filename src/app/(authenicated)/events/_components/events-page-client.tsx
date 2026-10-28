'use client'

/**
 * Events Page Client Component
 *
 * Displays list of events for the wedding.
 * Client component to enable interactivity (create/edit/delete).
 */

import { Loader2, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { EventCard } from '~/app/(authenicated)/events/_components/event-card'
import { ManageEventGuestsDialog } from '~/app/(authenicated)/events/_components/manage-event-guests-dialog'
import { ManageEventQuestionsDialog } from '~/app/(authenicated)/events/_components/manage-event-questions-dialog'
import { ManageGeneralQuestionsDialog } from '~/app/(authenicated)/events/_components/manage-general-questions-dialog'
import { ManageRsvpPagesDialog } from '~/app/(authenicated)/events/_components/manage-rsvp-pages-dialog'
import {
  type EventFormData,
  transformToServerInput,
} from '~/components/forms/event/event-form.schema'
import { ModernEventForm } from '~/components/forms/event/modern-event-form'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Button } from '~/components/ui/button'
import { DEFAULT_RSVP_STEPS } from '~/lib/rsvp/steps'
import type { Event, EventWithStats } from '~/server/domains/event/event.types'
import { api } from '~/trpc/react'

type EventsPageClientProps = Readonly<{
  initialEvents: EventWithStats[]
  initialRsvpEventId?: string
  initialWeddingRsvpSteps?: string[]
}>

export function EventsPageClient({
  initialEvents,
  initialRsvpEventId,
  initialWeddingRsvpSteps = [...DEFAULT_RSVP_STEPS],
}: EventsPageClientProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventWithStats | undefined>(undefined)
  const [deletingEvent, setDeletingEvent] = useState<EventWithStats | undefined>(undefined)
  const [managingGuestsEvent, setManagingGuestsEvent] = useState<EventWithStats | undefined>(
    undefined
  )
  const [managingQuestionsEventId, setManagingQuestionsEventId] = useState<string | null>(null)
  const [managingGeneralQuestions, setManagingGeneralQuestions] = useState(false)
  const [managingRsvpPages, setManagingRsvpPages] = useState(false)
  const [togglingRsvpEventId, setTogglingRsvpEventId] = useState<string | null>(null)
  const utils = api.useUtils()

  // Fetch events with RSVP statistics
  const { data: events = initialEvents, isLoading } = api.event.getAllByUserIdWithStats.useQuery(
    undefined,
    {
      initialData: initialEvents,
      staleTime: 30_000,
    }
  )

  // Website-level general questions (note to couple, children, etc.)
  const { data: websiteQuestions = null } = api.question.getWebsiteQuestions.useQuery(undefined, {
    staleTime: 30_000,
  })

  const createEvent = api.event.create.useMutation({
    onSuccess: async () => {
      // Wait for data to refetch before closing dialog
      await utils.event.getAllByUserIdWithStats.invalidate()
      toast.success('האירוע נוצר', {
        description: 'האירוע שלכם נוצר בהצלחה.',
      })
      setIsCreateDialogOpen(false)
    },
    onError: (error) => {
      toast.error('יצירת האירוע נכשלה', {
        description: error.message,
      })
    },
  })

  const updateEvent = api.event.update.useMutation({
    onSuccess: (updatedEvent: Event) => {
      utils.event.getAllByUserIdWithStats.setData(undefined, (previousEvents) => {
        if (!previousEvents) return previousEvents

        return previousEvents.map((event) => {
          if (event.id !== updatedEvent.id) return event

          return {
            ...event,
            ...updatedEvent,
          }
        })
      })

      toast.success('האירוע עודכן', {
        description: 'האירוע שלכם עודכן בהצלחה.',
      })
      setEditingEvent(undefined)
    },
    onError: (error) => {
      toast.error('עדכון האירוע נכשל', {
        description: error.message,
      })
    },
  })

  const deleteEvent = api.event.delete.useMutation({
    onSuccess: (deletedEventId: string) => {
      utils.event.getAllByUserIdWithStats.setData(undefined, (previousEvents) => {
        if (!previousEvents) return previousEvents

        return previousEvents.filter((event) => event.id !== deletedEventId)
      })

      toast.success('האירוע נמחק', {
        description: 'האירוע שלכם נמחק בהצלחה.',
      })
      setDeletingEvent(undefined)
    },
    onError: (error) => {
      toast.error('מחיקת האירוע נכשלה', {
        description: error.message,
      })
    },
  })

  const updateCollectRsvp = api.event.updateCollectRsvp.useMutation({
    onSuccess: async (updatedEvent) => {
      setTogglingRsvpEventId(null)
      utils.event.getAllByUserIdWithStats.setData(undefined, (previousEvents) => {
        if (!previousEvents) return previousEvents

        return previousEvents.map((event) => {
          if (event.id !== updatedEvent.id) return event

          return {
            ...event,
            collectRsvp: updatedEvent.collectRsvp,
          }
        })
      })
      toast.success('הגדרות אישור ההגעה עודכנו')
    },
    onError: (error) => {
      setTogglingRsvpEventId(null)
      toast.error('עדכון הגדרות אישור ההגעה נכשל', {
        description: error.message,
      })
    },
  })

  const handleCreateEvent = async (data: EventFormData) => {
    await createEvent.mutateAsync(transformToServerInput(data))
  }

  const handleUpdateEvent = async (data: EventFormData) => {
    if (!editingEvent) return
    await updateEvent.mutateAsync({
      eventId: editingEvent.id,
      ...transformToServerInput(data),
    })
  }

  const handleEditEvent = useCallback(
    (eventId: string) => {
      const eventToEdit = events.find((event) => event.id === eventId)
      if (!eventToEdit) return
      setEditingEvent(eventToEdit)
    },
    [events]
  )

  const handleDeleteEvent = useCallback(
    (eventId: string) => {
      const eventToDelete = events.find((event) => event.id === eventId)
      if (!eventToDelete) return
      setDeletingEvent(eventToDelete)
    },
    [events]
  )

  const handleManageGuests = useCallback(
    (eventId: string) => {
      const eventToManage = events.find((event) => event.id === eventId)
      if (!eventToManage) return
      setManagingGuestsEvent(eventToManage)
    },
    [events]
  )

  const handleManageQuestions = useCallback((eventId: string) => {
    setManagingQuestionsEventId(eventId)
  }, [])

  const managingQuestionsEvent =
    managingQuestionsEventId === null
      ? undefined
      : events.find((event) => event.id === managingQuestionsEventId)

  const handleToggleCollectRsvp = useCallback(
    (eventId: string, collectRsvp: boolean) => {
      setTogglingRsvpEventId(eventId)
      updateCollectRsvp.mutate({
        eventId,
        collectRsvp,
      })
    },
    [updateCollectRsvp]
  )

  const generalQuestionsButton = (
    <Button
      type='button'
      variant='outline'
      size='sm'
      onClick={() => setManagingGeneralQuestions(true)}
      disabled={websiteQuestions === null}
    >
      שאלות אישור הגעה כלליות
    </Button>
  )

  const generalQuestionsDialog =
    managingGeneralQuestions && websiteQuestions ? (
      <ManageGeneralQuestionsDialog
        websiteId={websiteQuestions.websiteId}
        isRsvpEnabled={websiteQuestions.isRsvpEnabled}
        questions={websiteQuestions.questions}
        open
        onOpenChange={(open) => !open && setManagingGeneralQuestions(false)}
      />
    ) : null

  // Show loading state
  if (isLoading && initialEvents.length === 0) {
    return (
      <div className='flex items-center justify-center py-12'>
        <p className='text-muted-foreground text-sm'>טוען אירועים...</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <>
        <div className='flex flex-col items-center gap-5 py-20 text-center'>
          <div className='flex h-16 w-16 items-center justify-center rounded-full border border-border/80 bg-muted/50'>
            <span className='text-2xl opacity-50' aria-hidden='true'>
              ☷
            </span>
          </div>
          <div className='max-w-sm'>
            <p className='font-serif text-foreground text-xl'>אין אירועים עדיין</p>
            <p className='mt-2 font-mono text-[0.65rem] text-foreground/55 leading-relaxed tracking-wider'>
              התחילו ביצירת אירוע החתונה הראשון שלכם. הוסיפו טקסים, קבלות פנים, ארוחות חזרה ועוד.
            </p>
          </div>
          <div className='flex flex-wrap items-center justify-center gap-2'>
            <Button
              type='button'
              onClick={() => setIsCreateDialogOpen(true)}
              className='font-mono text-[0.65rem] uppercase tracking-widest'
            >
              צרו את האירוע הראשון שלכם
            </Button>
            {generalQuestionsButton}
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setManagingRsvpPages(true)}
            >
              תצוגת דפים
            </Button>
          </div>
        </div>

        {isCreateDialogOpen ? (
          <ModernEventForm
            mode='create'
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
            onSubmit={handleCreateEvent}
            isSubmitting={createEvent.isPending}
          />
        ) : null}

        {generalQuestionsDialog}
        {managingRsvpPages ? (
          <ManageRsvpPagesDialog
            events={events}
            weddingRsvpSteps={initialWeddingRsvpSteps}
            open
            onOpenChange={(open) => !open && setManagingRsvpPages(false)}
          />
        ) : null}
      </>
    )
  }

  const rsvpFocusEvent =
    initialRsvpEventId === undefined
      ? undefined
      : events.find((event) => event.id === initialRsvpEventId)

  const sortedEvents = [...events].sort((a, b) => {
    if (a.date === null && b.date === null) return 0
    if (a.date === null) return 1
    if (b.date === null) return -1
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  return (
    <>
      {initialRsvpEventId !== undefined ? (
        <div className='mb-4 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm md:mb-6'>
          {rsvpFocusEvent
            ? `ניהול אישורי הגעה עבור ״${rsvpFocusEvent.name}״ — כרטיס האירוע מופיע למטה.`
            : 'בחרו אירוע למטה כדי לנהל אישורי הגעה.'}
        </div>
      ) : null}
      <div className='mb-4 flex items-center justify-between md:mb-6'>
        <p className='text-muted-foreground text-sm'>
          {events.length} {events.length === 1 ? 'אירוע' : 'אירועים'}
        </p>
        <div className='flex items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setManagingRsvpPages(true)}
          >
            תצוגת דפים
          </Button>
          {generalQuestionsButton}
          <Button onClick={() => setIsCreateDialogOpen(true)} size='sm'>
            <Plus className='me-2 h-4 w-4' />
            יצירת אירוע
          </Button>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3'>
        {sortedEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onEdit={handleEditEvent}
            onDelete={handleDeleteEvent}
            onManageGuests={handleManageGuests}
            onManageQuestions={handleManageQuestions}
            onToggleCollectRsvp={handleToggleCollectRsvp}
            isTogglingCollectRsvp={togglingRsvpEventId === event.id}
          />
        ))}
      </div>

      {isCreateDialogOpen ? (
        <ModernEventForm
          mode='create'
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSubmit={handleCreateEvent}
          isSubmitting={createEvent.isPending}
        />
      ) : null}

      {editingEvent ? (
        <ModernEventForm
          mode='edit'
          open
          onOpenChange={(open) => !open && setEditingEvent(undefined)}
          onSubmit={handleUpdateEvent}
          event={editingEvent}
          isSubmitting={updateEvent.isPending}
        />
      ) : null}

      <AlertDialog
        open={!!deletingEvent}
        onOpenChange={(open) => !open && setDeletingEvent(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק אירוע?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק לצמיתות את ״{deletingEvent?.name}״ ואת כל ההזמנות, השאלות והתשובות
              המשויכות אליו. לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEvent.isPending}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (deletingEvent) {
                  deleteEvent.mutate({ eventId: deletingEvent.id })
                }
              }}
              disabled={deleteEvent.isPending}
              className='flex items-center gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteEvent.isPending && <Loader2 className='h-4 w-4 animate-spin' />}
              {deleteEvent.isPending ? 'מוחק...' : 'מחיקת אירוע'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {managingGuestsEvent ? (
        <ManageEventGuestsDialog
          event={managingGuestsEvent}
          open
          onOpenChange={(open) => !open && setManagingGuestsEvent(undefined)}
        />
      ) : null}

      {managingQuestionsEvent ? (
        <ManageEventQuestionsDialog
          event={managingQuestionsEvent}
          open
          onOpenChange={(open) => !open && setManagingQuestionsEventId(null)}
        />
      ) : null}

      {generalQuestionsDialog}
      {managingRsvpPages ? (
        <ManageRsvpPagesDialog
          events={events}
          weddingRsvpSteps={initialWeddingRsvpSteps}
          open
          onOpenChange={(open) => !open && setManagingRsvpPages(false)}
        />
      ) : null}
    </>
  )
}
