import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { useToggleEventForm } from '~/components/contexts/event-form-context'
import { api } from '~/trpc/react'

const useEventFormActions = () => {
  const router = useRouter()
  const toggleEventForm = useToggleEventForm()

  const createEvent = api.event.create.useMutation({
    onSuccess: () => {
      toggleEventForm()
      router.refresh()
    },
    onError: (err) => {
      const fieldError = err.data?.zodError?.fieldErrors?.eventName?.[0]
      toast.error('יצירת האירוע נכשלה', {
        description: fieldError ?? err.message ?? 'נסו שוב מאוחר יותר',
      })
    },
  })

  const updateEvent = api.event.update.useMutation({
    onSuccess: () => {
      toggleEventForm()
      router.refresh()
    },
    onError: (err) => {
      const fieldError = err.data?.zodError?.fieldErrors?.eventName?.[0]
      toast.error('עדכון האירוע נכשל', {
        description: fieldError ?? err.message ?? 'נסו שוב מאוחר יותר',
      })
    },
  })

  const deleteEvent = api.event.delete.useMutation({
    onSuccess: () => {
      toggleEventForm()
      router.refresh()
    },
    onError: (err) => {
      const fieldError = err.data?.zodError?.fieldErrors?.eventName?.[0]
      toast.error('מחיקת האירוע נכשלה', {
        description: fieldError ?? err.message ?? 'נסו שוב מאוחר יותר',
      })
    },
  })

  return {
    createEvent: createEvent.mutate,
    updateEvent: updateEvent.mutate,
    deleteEvent: deleteEvent.mutate,
    isCreatingEvent: createEvent.isPending,
    isUpdatingEvent: updateEvent.isPending,
    isDeletingEvent: deleteEvent.isPending,
  }
}

export { useEventFormActions }
