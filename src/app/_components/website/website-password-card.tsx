'use client'

import { Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import { api } from '~/trpc/react'

type WebsitePasswordCardProps = Readonly<{
  initialIsPasswordEnabled: boolean
}>

/**
 * Couple-facing control for password-protecting the public wedding website.
 *
 * Guests who already opened a save-the-date / invite link are recognised by
 * their stored invite cookie and skip this password entirely — so the password
 * is the fallback for anyone the couple shares the bare link with.
 */
export function WebsitePasswordCard({ initialIsPasswordEnabled }: WebsitePasswordCardProps) {
  const router = useRouter()
  const [isEnabled, setIsEnabled] = useState(initialIsPasswordEnabled)
  const [password, setPassword] = useState('')

  const updateWebsite = api.website.update.useMutation({
    onSuccess: (website) => {
      setIsEnabled(website.isPasswordEnabled)
      setPassword('')
      toast.success(
        website.isPasswordEnabled ? 'הגנת הסיסמה הופעלה' : 'הגנת הסיסמה כובתה'
      )
      router.refresh()
    },
    onError: (error) => {
      toast.error('לא ניתן לעדכן את הגנת הסיסמה', {
        description: error.message ?? 'נסו שוב מאוחר יותר.',
      })
    },
  })

  const isSaving = updateWebsite.isPending

  const handleToggle = (checked: boolean) => {
    if (!checked) {
      // Turning protection off needs no password.
      updateWebsite.mutate({ isPasswordEnabled: false })
      return
    }
    // Reveal the password field; the couple confirms with Save.
    setIsEnabled(true)
  }

  const handleSavePassword = () => {
    const trimmed = password.trim()
    if (!trimmed) {
      toast.error('בחרו סיסמה כדי להגן על האתר')
      return
    }
    updateWebsite.mutate({ isPasswordEnabled: true, password: trimmed })
  }

  return (
    <Card className='border-border/80 bg-card/80'>
      <CardHeader className='space-y-3'>
        <p className='font-mono text-[0.62rem] text-foreground/45 uppercase tracking-[0.18em]'>
          פרטיות
        </p>
        <CardTitle className='flex items-center gap-2 font-serif text-2xl text-foreground'>
          <Lock aria-hidden='true' className='h-5 w-5' />
          הגנת סיסמה
        </CardTitle>
        <p className='max-w-2xl font-sans text-muted-foreground text-sm leading-6'>
          דרשו סיסמה לפני שאורחים יוכלו לצפות בעמוד החתונה הראשי. אורחים שפותחים את קישור
          ״שמרו את התאריך״ או ההזמנה שלהם מזוהים אוטומטית ולא יתבקשו להזין אותה.
        </p>
      </CardHeader>
      <CardContent className='space-y-5'>
        <div className='flex items-center justify-between gap-4'>
          <Label htmlFor='website-password-toggle' className='font-medium text-foreground text-sm'>
            נדרשת סיסמה
          </Label>
          <Switch
            id='website-password-toggle'
            checked={isEnabled}
            disabled={isSaving}
            onCheckedChange={handleToggle}
          />
        </div>

        {isEnabled ? (
          <div className='space-y-2'>
            <Label htmlFor='website-password-input' className='text-foreground/80 text-sm'>
              {initialIsPasswordEnabled ? 'עדכון סיסמת האורחים' : 'הגדרת סיסמת אורחים'}
            </Label>
            <div className='flex flex-wrap items-center gap-2'>
              <Input
                id='website-password-input'
                type='text'
                autoComplete='off'
                spellCheck={false}
                placeholder='למשל ForeverTogether'
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className='max-w-xs'
              />
              <Button type='button' onClick={handleSavePassword} disabled={isSaving}>
                {isSaving ? 'שומר…' : 'שמירת סיסמה'}
              </Button>
            </div>
            <p className='font-mono text-[0.58rem] text-foreground/45 tracking-wider'>
              בחרו סיסמה שקל לאורחים לזכור ולכם לשתף.
              {initialIsPasswordEnabled
                ? ' שמירת סיסמה חדשה מחליפה את הישנה עבור כולם.'
                : ''}
            </p>
          </div>
        ) : (
          <p className='font-sans text-muted-foreground text-sm'>
            כרגע כל מי שיש לו את הקישור יכול לצפות באתר.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
