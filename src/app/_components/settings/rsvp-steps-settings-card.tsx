'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { IoArrowDown, IoArrowUp } from 'react-icons/io5'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Switch } from '~/components/ui/switch'
import { normalizeRsvpSteps, RSVP_STEP_KEYS, type RsvpStepKey } from '~/lib/rsvp/steps'
import { api } from '~/trpc/react'

const STEP_LABELS: Record<RsvpStepKey, { title: string; description: string }> = {
  'children-count': {
    title: 'מספר ילדים',
    description: 'אוסף את מספר הילדים מתחת לגיל 10 לצורך חישוב המנות.',
  },
  'dietary-notes': {
    title: 'הערות תזונתיות',
    description: 'מאפשר למשק הבית לציין אלרגיות, רגישויות או בקשות אוכל.',
  },
  'wishes-message': {
    title: 'ברכה לזוג',
    description: 'מאפשר לאורחים להשאיר ברכה קצרה יחד עם אישור ההגעה.',
  },
}

type RsvpStepsSettingsCardProps = Readonly<{
  rsvpSteps: string[]
}>

export function RsvpStepsSettingsCard({ rsvpSteps }: RsvpStepsSettingsCardProps) {
  const router = useRouter()
  const [isRefreshing, startTransition] = useTransition()
  const initialEnabledSteps = useMemo(() => normalizeRsvpSteps(rsvpSteps), [rsvpSteps])
  const [enabledSteps, setEnabledSteps] = useState<RsvpStepKey[]>(initialEnabledSteps)
  const [orderedSteps, setOrderedSteps] = useState<RsvpStepKey[]>(() => [
    ...initialEnabledSteps,
    ...RSVP_STEP_KEYS.filter((step) => !initialEnabledSteps.includes(step)),
  ])

  const updateRsvpSteps = api.wedding.updateRsvpSteps.useMutation({
    onError: () => toast.error('לא ניתן לשמור את זרימת אישור ההגעה.'),
    onSuccess: (updatedWedding) => {
      setEnabledSteps(normalizeRsvpSteps(updatedWedding.rsvpSteps))
      toast.success('זרימת אישור ההגעה נשמרה.')
      startTransition(() => router.refresh())
    },
  })

  const enabledSet = new Set(enabledSteps)
  const orderedEnabledSteps = orderedSteps.filter((step) => enabledSet.has(step))
  const guestPageCount = orderedEnabledSteps.length + 2

  const setStepEnabled = (step: RsvpStepKey, enabled: boolean) => {
    setEnabledSteps((current) =>
      enabled ? [...current, step] : current.filter((currentStep) => currentStep !== step)
    )
  }

  const moveStep = (index: number, offset: -1 | 1) => {
    setOrderedSteps((current) => {
      const targetIndex = index + offset
      if (targetIndex < 0 || targetIndex >= current.length) return current
      const next = [...current]
      const movedStep = next[index] as RsvpStepKey
      next[index] = next[targetIndex] as RsvpStepKey
      next[targetIndex] = movedStep
      return next
    })
  }

  return (
    <Card className='border-border/80 bg-card/80' dir='rtl'>
      <CardContent className='p-0'>
        <div className='border-border/70 border-b px-6 py-5'>
          <p className='font-mono text-[0.62rem] text-foreground/45 uppercase tracking-[0.18em]'>
            זרימת אישור הגעה
          </p>
          <h4 className='mt-1.5 font-serif text-foreground text-lg'>העמודים שהאורחים יראו</h4>
          <p className='mt-1 max-w-xl font-sans text-muted-foreground text-sm leading-6'>
            בחרו אילו שאלות יוצגו וסדרו אותן. העמודים ״מי מגיע״ ו״שליחת אישור״ תמיד מופיעים.
          </p>
        </div>

        <div className='divide-y divide-border/70 px-6'>
          {orderedSteps.map((step, index) => {
            const isEnabled = enabledSet.has(step)
            const label = STEP_LABELS[step]
            return (
              <div className='flex items-center gap-4 py-4' key={step}>
                <Switch
                  aria-label={`הצגת ${label.title}`}
                  checked={isEnabled}
                  disabled={updateRsvpSteps.isPending || isRefreshing}
                  onCheckedChange={(checked) => setStepEnabled(step, checked)}
                />
                <div className='min-w-0 flex-1'>
                  <p className='font-medium font-sans text-foreground text-sm'>{label.title}</p>
                  <p className='mt-0.5 font-sans text-muted-foreground text-xs leading-5'>
                    {label.description}
                  </p>
                </div>
                <div className='flex gap-1'>
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='h-8 w-8 rounded-sm'
                    disabled={index === 0 || updateRsvpSteps.isPending || isRefreshing}
                    aria-label={`העלאת ${label.title}`}
                    onClick={() => moveStep(index, -1)}
                  >
                    <IoArrowUp aria-hidden='true' />
                  </Button>
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='h-8 w-8 rounded-sm'
                    disabled={
                      index === orderedSteps.length - 1 || updateRsvpSteps.isPending || isRefreshing
                    }
                    aria-label={`הורדת ${label.title}`}
                    onClick={() => moveStep(index, 1)}
                  >
                    <IoArrowDown aria-hidden='true' />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {!enabledSet.has('children-count') ? (
          <p
            role='alert'
            className='mx-6 border-primary/30 border-t py-3 font-sans text-primary text-sm'
          >
            ללא שאלת מספר הילדים, ספירת מנות הילדים בדוח המטבח תהיה ריקה כאשר אין נתוני גיל לאורחים.
          </p>
        ) : null}

        <div className='flex flex-wrap items-center justify-between gap-3 border-border/70 border-t px-6 py-4'>
          <p className='font-mono text-[0.62rem] text-muted-foreground tracking-wide'>
            {guestPageCount} עמודים קבועים לאורח
          </p>
          <Button
            type='button'
            className='rounded-sm font-mono text-xs tracking-wide'
            disabled={updateRsvpSteps.isPending || isRefreshing}
            onClick={() => updateRsvpSteps.mutate({ rsvpSteps: orderedEnabledSteps })}
          >
            {updateRsvpSteps.isPending ? 'שומר...' : 'שמירת הזרימה'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
