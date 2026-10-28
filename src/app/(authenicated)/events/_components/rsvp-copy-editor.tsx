'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import {
  getDefaultRsvpCopy,
  RSVP_COPY_GROUPS,
  type RsvpCopyKey,
  type RsvpCopyOverrides,
} from '~/lib/rsvp/copy'
import { api } from '~/trpc/react'

type RsvpCopyEditorProps = Readonly<{ open: boolean }>

function withoutKey(copy: RsvpCopyOverrides, key: RsvpCopyKey): RsvpCopyOverrides {
  return Object.fromEntries(Object.entries(copy).filter(([entryKey]) => entryKey !== key))
}

export function RsvpCopyEditor({ open }: RsvpCopyEditorProps) {
  const utils = api.useUtils()
  const copyQuery = api.wedding.getRsvpCopy.useQuery(undefined, { enabled: open })
  const [draft, setDraft] = useState<RsvpCopyOverrides | null>(null)
  const currentCopy = draft ?? copyQuery.data ?? {}

  const updateCopy = api.wedding.updateRsvpCopy.useMutation({
    onSuccess: (savedCopy) => {
      setDraft(savedCopy)
      utils.wedding.getRsvpCopy.setData(undefined, savedCopy)
      toast.success('נוסחי אישור ההגעה נשמרו')
    },
    onError: (error) => toast.error('שמירת הנוסחים נכשלה', { description: error.message }),
  })

  const setField = (key: RsvpCopyKey, value: string) => {
    setDraft((existingDraft) => {
      const next = { ...(existingDraft ?? copyQuery.data ?? {}) }
      const trimmed = value.trim()
      if (!trimmed || trimmed === getDefaultRsvpCopy(key)) return withoutKey(next, key)
      next[key] = value
      return next
    })
  }

  if (copyQuery.isLoading) {
    return <p className='py-8 text-center text-muted-foreground text-sm'>טוען נוסחים...</p>
  }

  if (copyQuery.error) {
    return (
      <p role='alert' className='py-8 text-center text-destructive text-sm'>
        {copyQuery.error.message}
      </p>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between gap-3'>
        <p className='text-muted-foreground text-sm'>
          שדות שלא שונו משתמשים אוטומטית בנוסח ברירת המחדל.
        </p>
        <Button type='button' size='sm' variant='outline' onClick={() => setDraft({})}>
          איפוס הכול
        </Button>
      </div>

      {RSVP_COPY_GROUPS.map((group) => (
        <section key={group.id}>
          <h3 className='mb-3 flex items-center gap-2 font-mono text-[0.62rem] text-muted-foreground tracking-wider after:h-px after:flex-1 after:bg-border'>
            {group.label}
          </h3>
          <div className='space-y-4'>
            {group.fields.map(([key, label]) => {
              const defaultValue = getDefaultRsvpCopy(key)
              const override = currentCopy[key]
              return (
                <div className='rounded-md border border-border p-4' key={key}>
                  <div className='mb-2 flex items-center justify-between gap-3'>
                    <label
                      className='font-sans text-foreground text-sm'
                      htmlFor={`rsvp-copy-${key}`}
                    >
                      {label}
                    </label>
                    <Button
                      type='button'
                      size='sm'
                      variant='ghost'
                      className='h-7 px-2 text-xs'
                      disabled={override === undefined}
                      onClick={() => setDraft(withoutKey(currentCopy, key))}
                    >
                      איפוס לברירת מחדל
                    </Button>
                  </div>
                  <Textarea
                    id={`rsvp-copy-${key}`}
                    dir='rtl'
                    maxLength={600}
                    rows={3}
                    value={override ?? defaultValue}
                    onChange={(event) => setField(key, event.target.value)}
                  />
                  {override !== undefined ? (
                    <p className='mt-2 whitespace-pre-line text-muted-foreground text-xs'>
                      ברירת מחדל: {defaultValue}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <div className='sticky bottom-0 flex justify-end border-border border-t bg-background/95 pt-4'>
        <Button
          type='button'
          disabled={updateCopy.isPending}
          onClick={() => updateCopy.mutate({ rsvpCopy: currentCopy })}
        >
          {updateCopy.isPending ? 'שומר...' : 'שמירת נוסחים'}
        </Button>
      </div>
    </div>
  )
}
