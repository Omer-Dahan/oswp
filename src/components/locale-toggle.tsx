'use client'

import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

const NEXT_LOCALE = { en: 'he', he: 'es', es: 'en' } as const

const LOCALE_LABEL = { en: 'English', he: 'עברית', es: 'Español' } as const

export function LocaleToggle() {
  const locale = useLocale()
  const router = useRouter()

  const switchTo = NEXT_LOCALE[locale as keyof typeof NEXT_LOCALE] ?? 'en'

  const handleSwitch = async () => {
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: switchTo }),
    })
    router.refresh()
  }

  return (
    <button
      type='button'
      onClick={handleSwitch}
      className='font-mono text-muted-foreground text-xs uppercase tracking-[0.22em] hover:text-foreground'
      aria-label={`Switch to ${LOCALE_LABEL[switchTo]}`}
    >
      {LOCALE_LABEL[switchTo]}
    </button>
  )
}
