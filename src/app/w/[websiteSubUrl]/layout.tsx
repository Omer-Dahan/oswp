import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { LocaleToggle } from '~/components/locale-toggle'
import { hebrewAlt, hebrewLight, hebrewSans, hebrewSerif } from '~/templates/fonts'

export default async function WeddingWebsiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale()
  const messages = await getMessages()
  const isHebrew = locale === 'he'

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
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
