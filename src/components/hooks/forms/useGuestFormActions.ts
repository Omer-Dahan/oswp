import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { useToggleGuestForm } from '~/components/contexts/guest-form-context'
import { api } from '~/trpc/react'

const useGuestFormActions = (closeForm: boolean, resetForm: () => void) => {
  const router = useRouter()
  const toggleGuestForm = useToggleGuestForm()
  const createGuests = api.household.create.useMutation({
    onSuccess: () => {
      if (closeForm) toggleGuestForm()
      router.refresh()
      resetForm()
    },
    onError: (err) => {
      const fieldError = err.data?.zodError?.fieldErrors?.guestParty?.[0]
      toast.error('יצירת האורחים נכשלה', {
        description: fieldError ?? err.message ?? 'נסו שוב מאוחר יותר',
      })
    },
  })

  const updateHousehold = api.household.update.useMutation({
    onSuccess: () => {
      toggleGuestForm()
      router.refresh()
      resetForm()
    },
    onError: (err) => {
      const fieldError = err.data?.zodError?.fieldErrors?.guestParty?.[0]
      toast.error('עדכון משק הבית נכשל', {
        description: fieldError ?? err.message ?? 'נסו שוב מאוחר יותר',
      })
    },
  })

  const deleteHousehold = api.household.delete.useMutation({
    onSuccess: () => {
      toggleGuestForm()
      router.refresh()
    },
    onError: (err) => {
      const fieldError = err.data?.zodError?.fieldErrors?.eventName?.[0]
      toast.error('מחיקת משק הבית נכשלה', {
        description: fieldError ?? err.message ?? 'נסו שוב מאוחר יותר',
      })
    },
  })

  return {
    createGuests: createGuests.mutate,
    updateHousehold: updateHousehold.mutate,
    deleteHousehold: deleteHousehold.mutate,
    isCreatingGuests: createGuests.isPending,
    isUpdatingHousehold: updateHousehold.isPending,
    isDeletingHousehold: deleteHousehold.isPending,
  }
}

export { useGuestFormActions }
