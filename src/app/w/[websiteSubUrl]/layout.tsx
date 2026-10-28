import { type AbstractIntlMessages, NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { loadVisitorWedding } from '~/app/w/[websiteSubUrl]/_lib/load-visitor-wedding'
import { LocaleToggle } from '~/components/locale-toggle'
import type { RsvpCopyOverrides } from '~/lib/rsvp/copy'
import { hebrewAlt, hebrewLight, hebrewSans, hebrewSerif } from '~/templates/fonts'

export function mergeGuestRsvpMessages(
  messages: AbstractIntlMessages,
  overrides: RsvpCopyOverrides
): AbstractIntlMessages {
  const rsvpMessages = messages.rsvp
  if (!rsvpMessages || typeof rsvpMessages !== 'object' || Array.isArray(rsvpMessages)) {
    return messages
  }
  return { ...messages, rsvp: { ...rsvpMessages, ...overrides } }
}

export default async function WeddingWebsiteLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ websiteSubUrl: string }>
}>) {
  const [locale, messages, { websiteSubUrl }] = await Promise.all([
    getLocale(),
    getMessages(),
    params,
  ])
  const isHebrew = locale === 'he'
  let guestMessages = messages

  if (isHebrew) {
    const { loadResult } = await loadVisitorWedding(websiteSubUrl)
    if (loadResult.status === 'ready') {
      guestMessages = mergeGuestRsvpMessages(messages, loadResult.weddingData.rsvpCopy)
    }
  }

  return (
    <NextIntlClientProvider locale={locale} messages={guestMessages}>
      {/* Guest-facing pages keep the original styling; see globals.css. */}
      <div
        data-guest-surface
        data-guest-surface-he={isHebrew ? '' : undefined}
        dir={isHebrew ? 'rtl' : 'ltr'}
        lang={locale}
        className={`contents ${hebrewSerif.variable} ${hebrewSans.variable} ${hebrewAlt.variable} ${hebrewLight.variable}`}
        style={
          {
            // Fallback so `--tpl-body-font` / `--tpl-heading-font` are always real
            // (not inherited serif from the root layout) even before a template's
            // own TemplateThemeProvider further down sets its concrete stacks —
            // e.g. during the rsvp loading/suspense fallback, which has no template yet.
            '--tpl-body-font': 'var(--tpl-hebrew-sans), sans-serif',
            '--tpl-heading-font': 'var(--tpl-hebrew-serif), serif',
          } as React.CSSProperties
        }
      >
        <div className='fixed top-3 end-3 z-50'>
          <LocaleToggle />
        </div>
        {children}
      </div>
    </NextIntlClientProvider>
  )
}
