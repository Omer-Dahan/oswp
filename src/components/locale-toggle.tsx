'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

const NEXT_LOCALE = { en: 'he', he: 'en' } as const

const LOCALE_LABEL = { en: 'EN', he: 'עברית' } as const

/** The guest invitation home (`/w/<subUrl>`) is chrome-free; its own route hides this. */
const INVITATION_HOME_PATTERN = /^\/w\/[^/]+\/?$/

export function LocaleToggle() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  if (INVITATION_HOME_PATTERN.test(pathname)) {
    return null
  }

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
