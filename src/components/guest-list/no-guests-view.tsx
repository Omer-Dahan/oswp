import type { Dispatch, SetStateAction } from 'react'
import { useToggleGuestForm } from '~/components/contexts/guest-form-context'
import type { HouseholdFormData } from '~/components/forms/guest-form.schema'
import { InviteLinkPanel } from '~/components/guest-list/invite-link-panel'
import { Button } from '~/components/ui/button'

type NoGuestsViewProps = {
  setPrefillHousehold: Dispatch<SetStateAction<HouseholdFormData | undefined>>
  onImportClick: () => void
}

export default function NoGuestsView({ setPrefillHousehold, onImportClick }: NoGuestsViewProps) {
  const toggleGuestForm = useToggleGuestForm()

  return (
    <div className='flex flex-col items-center gap-6 py-16 text-center'>
      <div className='flex h-16 w-16 items-center justify-center rounded-full border border-border/80 bg-muted/50'>
        <span className='text-2xl opacity-50' aria-hidden='true'>
          ◉
        </span>
      </div>
      <div className='max-w-sm'>
        <p className='font-serif text-foreground text-xl'>אין אורחים עדיין</p>
        <p className='mt-2 font-mono text-[0.65rem] text-foreground/55 leading-relaxed tracking-wider'>
          הוסיפו אורחים אחד אחד או ייבאו מקובץ CSV. עקבו אחר אישורי הגעה, פרטי קשר ומידע על משקי
          הבית, הכול במקום אחד.
        </p>
      </div>
      <div
        data-testid='guest-actions-cluster'
        className='grid w-full max-w-2xl grid-cols-1 items-center justify-center gap-3 sm:grid-cols-3'
      >
        <Button
          type='button'
          onClick={() => {
            setPrefillHousehold(undefined)
            toggleGuestForm()
          }}
          className='font-mono text-[0.65rem] uppercase tracking-widest'
        >
          הוסיפו את האורח הראשון
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={onImportClick}
          className='font-mono text-[0.65rem] uppercase tracking-widest'
        >
          ייבוא מ-CSV
        </Button>
        <InviteLinkPanel className='col-span-full text-start' />
      </div>
    </div>
  )
}
