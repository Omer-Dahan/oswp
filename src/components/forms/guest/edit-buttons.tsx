import { Loader2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'

import { useToggleGuestForm } from '~/components/contexts/guest-form-context'
import { Button } from '~/components/ui/button'

type EditFormButtonsProps = {
  isUpdatingHousehold: boolean
  setShowDeleteConfirmation: Dispatch<SetStateAction<boolean>>
}

export default function EditFormButtons({
  isUpdatingHousehold,
  setShowDeleteConfirmation,
}: EditFormButtonsProps) {
  const toggleGuestForm = useToggleGuestForm()

  return (
    <div className='fixed end-0 bottom-0 start-0 z-20 space-y-3 border-t bg-background p-6 sm:end-0 sm:start-auto sm:w-[525px]'>
      <div className='flex flex-col gap-3 sm:flex-row'>
        <Button
          type='button'
          variant='outline'
          disabled={isUpdatingHousehold}
          onClick={() => toggleGuestForm()}
          className='w-full sm:flex-1'
        >
          ביטול
        </Button>
        <Button
          id='edit-save'
          type='submit'
          disabled={isUpdatingHousehold}
          className='w-full sm:flex-1'
        >
          {isUpdatingHousehold && <Loader2 className='me-2 h-4 w-4 animate-spin' />}
          {isUpdatingHousehold ? 'שומר...' : 'שמירת שינויים'}
        </Button>
      </div>
      <Button
        type='button'
        variant='ghost'
        disabled={isUpdatingHousehold}
        onClick={(e) => {
          e.preventDefault()
          setShowDeleteConfirmation(true)
        }}
        className='w-full text-destructive hover:bg-destructive/10 hover:text-destructive'
      >
        מחיקת משפחה
      </Button>
    </div>
  )
}
