import { Loader2 } from 'lucide-react'

import { useToggleGuestForm } from '~/components/contexts/guest-form-context'
import { Button } from '~/components/ui/button'

type AddFormButtonsProps = {
  isCreatingGuests: boolean
  shouldCloseAfterSave?: boolean
  onSaveIntentChange?: (shouldClose: boolean) => void
}

export default function AddFormButtons({
  isCreatingGuests,
  shouldCloseAfterSave: _shouldCloseAfterSave,
  onSaveIntentChange,
}: AddFormButtonsProps) {
  const toggleGuestForm = useToggleGuestForm()
  return (
    <div className='fixed end-0 bottom-0 start-0 z-20 space-y-3 border-t bg-background p-6 sm:end-0 sm:start-auto sm:w-[525px]'>
      <div className='flex flex-col gap-3 sm:flex-row'>
        <Button
          id='save-household-close'
          type='submit'
          variant='outline'
          disabled={isCreatingGuests}
          onClick={() => onSaveIntentChange?.(true)}
          className='w-full sm:flex-1'
        >
          {isCreatingGuests && <Loader2 className='me-2 h-4 w-4 animate-spin' />}
          {isCreatingGuests ? 'שומר...' : 'שמירה וסגירה'}
        </Button>
        <Button
          id='save-household-another'
          type='submit'
          disabled={isCreatingGuests}
          onClick={() => onSaveIntentChange?.(false)}
          className='w-full sm:flex-1'
        >
          {isCreatingGuests && <Loader2 className='me-2 h-4 w-4 animate-spin' />}
          {isCreatingGuests ? 'שומר...' : 'שמירה והוספת משפחה נוספת'}
        </Button>
      </div>
      <Button
        type='button'
        variant='ghost'
        onClick={() => toggleGuestForm()}
        disabled={isCreatingGuests}
        className='w-full'
      >
        ביטול
      </Button>
    </div>
  )
}
