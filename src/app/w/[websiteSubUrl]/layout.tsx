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
      >
        <div className='fixed top-3 right-3 z-50'>
          <LocaleToggle />
        </div>
        {children}
      </div>
    </NextIntlClientProvider>
  )
}
