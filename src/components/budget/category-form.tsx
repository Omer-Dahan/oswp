'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import type { BudgetCategoryWithExpenses } from '~/server/domains/budget/budget.types'
import { api } from '~/trpc/react'

type CategoryFormBaseProps = {
  currency: string
  onSuccess: () => void
  onCancel: () => void
}

type CategoryFormProps =
  | (CategoryFormBaseProps & { mode: 'create'; category?: never })
  | (CategoryFormBaseProps & { mode: 'edit'; category: BudgetCategoryWithExpenses })

export function CategoryForm(props: Readonly<CategoryFormProps>) {
  const { mode, currency, onSuccess, onCancel } = props
  const isEditing = mode === 'edit'
  const category = mode === 'edit' ? props.category : undefined
  const utils = api.useUtils()

  const [name, setName] = useState(category?.name ?? '')
  const [plannedAmount, setPlannedAmount] = useState(category ? String(category.plannedAmount) : '')

  const invalidate = () => utils.budget.getOverview.invalidate()

  const createCategory = api.budget.createCategory.useMutation({
    onSuccess: async () => {
      await invalidate()
      toast.success('הסעיף נוסף')
      onSuccess()
    },
    onError: (err) => toast.error(err.message || 'לא ניתן להוסיף את הסעיף'),
  })

  const updateCategory = api.budget.updateCategory.useMutation({
    onSuccess: async () => {
      await invalidate()
      toast.success('הסעיף עודכן')
      onSuccess()
    },
    onError: (err) => toast.error(err.message || 'לא ניתן לעדכן את הסעיף'),
  })

  const isPending = createCategory.isPending || updateCategory.isPending

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      toast.error('יש להזין שם סעיף')
      return
    }
    const parsed = plannedAmount ? Number.parseFloat(plannedAmount) : 0
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('יש להזין סכום מתוכנן תקין')
      return
    }

    if (isEditing && category) {
      updateCategory.mutate({ categoryId: category.id, name: name.trim(), plannedAmount: parsed })
    } else {
      createCategory.mutate({ name: name.trim(), plannedAmount: parsed })
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='space-y-1.5'>
        <Label htmlFor='category-name'>שם הסעיף</Label>
        <Input
          id='category-name'
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='למשל: אולם, קייטרינג, לבוש'
          maxLength={100}
          required
        />
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='category-planned'>תקציב מתוכנן ({currency})</Label>
        <Input
          id='category-planned'
          type='number'
          inputMode='decimal'
          min='0'
          step='0.01'
          value={plannedAmount}
          onChange={(e) => setPlannedAmount(e.target.value)}
          placeholder='0.00'
        />
      </div>
      <div className='flex justify-end gap-2 pt-1'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={isPending}>
          ביטול
        </Button>
        <Button type='submit' disabled={isPending}>
          {isPending ? 'שומר...' : isEditing ? 'שמירת שינויים' : 'הוספת שלב'}
        </Button>
      </div>
    </form>
  )
}
