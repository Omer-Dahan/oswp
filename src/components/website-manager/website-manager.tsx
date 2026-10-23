'use client'

import { AlertCircle, Check, Copy, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { computePublicWebsiteUrl } from '~/lib/website/public-url'
import { isValidWeddingSubUrl } from '~/lib/website-slug'
import type { WebsiteWithComputedUrl } from '~/server/domains/website/website.types'
import { api } from '~/trpc/react'

type WebsiteManagerProps = {
  initialWebsite: WebsiteWithComputedUrl | null
  userEmail: string
  defaultSubUrl: string
}

const copyToClipboard = async (value: string) => {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

export function WebsiteManager({ initialWebsite, userEmail, defaultSubUrl }: WebsiteManagerProps) {
  const router = useRouter()
  const utils = api.useUtils()
  const { data: website } = api.website.getByUserId.useQuery(undefined, {
    initialData: initialWebsite,
  })
  const [copied, setCopied] = useState(false)
  const [subUrl, setSubUrl] = useState(defaultSubUrl)

  const publishWebsite = api.website.create.useMutation({
    onSuccess: async () => {
      toast.success('אתר החתונה שלכם באוויר')
      await utils.website.getByUserId.invalidate()
      router.refresh()
    },
    onError: (error) => {
      toast.error(error.message || 'פרסום האתר נכשל. נסו שוב.')
    },
  })

  if (website) {
    const liveUrl = computePublicWebsiteUrl(website.subUrl)

    const handleCopy = async () => {
      const didCopy = await copyToClipboard(liveUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success(didCopy ? 'הקישור לאתר הועתק' : 'הקישור לאתר מוכן להעתקה', {
        description: didCopy ? undefined : liveUrl,
      })
    }

    return (
      <div className='rounded-md border border-border/70 bg-card p-5'>
        <span className='inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2 py-0.5 font-mono text-[0.58rem] text-success uppercase tracking-widest'>
          <Check className='h-3 w-3' aria-hidden='true' />
          פורסם
        </span>
        <p className='mt-3 text-foreground/75 text-sm leading-relaxed'>
          אתר החתונה שלכם באוויר. שתפו את הקישור עם האורחים, או השתמשו בקישורי ״שמרו את התאריך״
          ברשימת האורחים כדי להזמין כל משק בית.
        </p>
        <div className='mt-4 flex flex-wrap items-center gap-2'>
          <code className='flex-1 break-all rounded-sm border border-border/70 bg-muted/40 px-3 py-2 font-mono text-foreground/80 text-xs'>
            {liveUrl}
          </code>
          <Button type='button' variant='outline' size='sm' onClick={handleCopy}>
            {copied ? (
              <Check className='h-3.5 w-3.5' aria-hidden='true' />
            ) : (
              <Copy className='h-3.5 w-3.5' aria-hidden='true' />
            )}
            העתקת קישור
          </Button>
          <Button asChild variant='outline' size='sm'>
            <a href={liveUrl} target='_blank' rel='noreferrer'>
              <ExternalLink className='h-3.5 w-3.5' aria-hidden='true' />
              צפו באתר
            </a>
          </Button>
        </div>
      </div>
    )
  }

  const trimmedSubUrl = subUrl.trim()
  const isSubUrlValid = isValidWeddingSubUrl(trimmedSubUrl)
  const previewHost = typeof window !== 'undefined' ? window.location.host : 'your-site.com'

  const handlePublish = () => {
    if (!isSubUrlValid) return
    publishWebsite.mutate({
      basePath: typeof window !== 'undefined' ? window.location.host : '',
      email: userEmail,
      subUrl: trimmedSubUrl,
    })
  }

  return (
    <div className='rounded-md border border-border/70 bg-card p-5'>
      <span className='inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[0.58rem] text-foreground/60 uppercase tracking-widest'>
        לא פורסם
      </span>
      <p className='mt-3 text-foreground/75 text-sm leading-relaxed'>
        פרסמו את אתר החתונה כדי לקבל עמוד ציבורי לאורחים. נדרש אתר מפורסם לפני שתוכלו לשתף
        קישורי ״שמרו את התאריך״ מרשימת האורחים.
      </p>

      <div className='mt-4 space-y-1.5'>
        <Label htmlFor='website-suburl' className='font-medium text-foreground text-sm'>
          כתובת האתר
        </Label>
        <div
          className={`flex items-center overflow-hidden rounded-[4px] border bg-background focus-within:ring-2 focus-within:ring-offset-2 ${
            isSubUrlValid
              ? 'border-input focus-within:ring-ring'
              : 'border-destructive focus-within:ring-destructive'
          }`}
        >
          <span className='whitespace-nowrap border-input border-r bg-muted/40 px-3 py-2 font-mono text-foreground/55 text-xs'>
            {previewHost}/w/
          </span>
          <Input
            id='website-suburl'
            value={subUrl}
            onChange={(event) => setSubUrl(event.target.value)}
            placeholder={defaultSubUrl}
            aria-invalid={!isSubUrlValid}
            aria-describedby='website-suburl-hint'
            className='border-0 font-mono text-xs focus-visible:ring-0 focus-visible:ring-offset-0'
          />
        </div>
        {isSubUrlValid ? (
          <p
            id='website-suburl-hint'
            className='font-mono text-[0.58rem] text-foreground/50 tracking-wider'
          >
            אותיות, מספרים, מקפים וקווים תחתונים בלבד. תוכלו לשנות זאת מאוחר יותר בהגדרות.
          </p>
        ) : (
          <p
            id='website-suburl-hint'
            role='alert'
            className='flex items-center gap-1.5 rounded-sm border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 font-medium text-destructive text-xs'
          >
            <AlertCircle className='h-3.5 w-3.5 shrink-0' aria-hidden='true' />
            השתמשו באותיות, מספרים, מקפים וקווים תחתונים בלבד, ללא רווחים או תווים מיוחדים
            אחרים.
          </p>
        )}
      </div>

      <div className='mt-4'>
        <Button
          type='button'
          disabled={publishWebsite.isPending || !isSubUrlValid}
          onClick={handlePublish}
        >
          {publishWebsite.isPending ? 'מפרסם…' : 'פרסום האתר'}
        </Button>
      </div>
    </div>
  )
}
