import type { UseFormSetValue, UseFormWatch } from 'react-hook-form'

import type { HouseholdFormData } from '~/components/forms/guest-form.schema'
import { SideGroupCombobox, useHouseholdSideGroupOptions } from '~/components/forms/guest/side-group-combobox'
import { Label } from '~/components/ui/label'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'

type SideGroupFormProps = {
  watch: UseFormWatch<HouseholdFormData>
  setValue: UseFormSetValue<HouseholdFormData>
  households: HouseholdWithGuests[]
}

export default function SideGroupForm({ watch, setValue, households }: SideGroupFormProps) {
  const { sides, groupsForSide } = useHouseholdSideGroupOptions(households)
  const side = watch('side') ?? ''
  const groupName = watch('groupName') ?? ''

  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      <div className='space-y-2'>
        <Label htmlFor='side'>צד</Label>
        <SideGroupCombobox
          id='side'
          value={side}
          onChange={(value) => setValue('side', value, { shouldDirty: true })}
          options={sides}
          placeholder='כלה / חתן / ...'
          className='flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='groupName'>קבוצה</Label>
        <SideGroupCombobox
          id='groupName'
          value={groupName}
          onChange={(value) => setValue('groupName', value, { shouldDirty: true })}
          options={groupsForSide(side)}
          placeholder='משפחה / חברים / עבודה / ...'
          className='flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        />
      </div>
    </div>
  )
}
