import '~/styles/globals.css'

import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, DM_Mono, Instrument_Serif } from 'next/font/google'
import { Toaster as SonnerToaster } from 'sonner'

import { Providers } from '~/app/providers'
import { Toaster } from '~/components/ui/toaster'
import { TRPCReactProvider } from '~/trpc/react'

// Design fonts matching the HTML prototype
const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument',
  display: 'swap',
})

export const viewport: Viewport = {
  initialScale: 1,
  width: 'device-width',
}

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'OSWP — פלטפורמת ניהול החתונה שלכם',
    template: '%s | OSWP',
  },
  description:
    'פלטפורמה מודרנית לניהול חתונות עם הזמנות, אישורי הגעה, ניהול אורחים ו-Etta, מתכננת החתונה החכמה שלכם. קוד פתוח וחינמי.',
  keywords: [
    'תכנון חתונה',
    'ניהול אישורי הגעה',
    'הזמנות לחתונה',
    'ניהול רשימת אורחים',
    'חתונה קוד פתוח',
    'פלטפורמת חתונות',
    'בניית אתר חתונה',
    'מתכננת חתונה חכמה',
    'סידורי הושבה',
    'ניהול ספקים',
  ],
  authors: [{ name: 'OSWP', url: 'https://github.com/dccakes/SCV' }],
  creator: 'OSWP',
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    siteName: 'OSWP',
    title: 'OSWP — פלטפורמת ניהול החתונה שלכם',
    description:
      'פלטפורמה מודרנית לניהול חתונות עם הזמנות, אישורי הגעה, ניהול אורחים ו-Etta, מתכננת החתונה החכמה שלכם.',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OSWP — פלטפורמת ניהול החתונה שלכם',
    description: 'ניהול חתונה עם הזמנות, אישורי הגעה ו-Etta, מתכננת החתונה החכמה שלכם. קוד פתוח וחינמי.',
  },
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang='he'
      dir='rtl'
      suppressHydrationWarning
      className={`${cormorantGaramond.variable} ${dmMono.variable} ${instrumentSerif.variable} antialiased`}
    >
      <body className='bg-background text-foreground antialiased'>
        <Providers>
          <TRPCReactProvider>
            {children}
            <Toaster />
            <SonnerToaster richColors position='top-right' />
          </TRPCReactProvider>
        </Providers>
      </body>
    </html>
  )
}
