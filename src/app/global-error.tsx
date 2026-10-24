'use client'

import posthog from 'posthog-js'
import { useEffect } from 'react'

type GlobalErrorBoundaryProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalErrorBoundary({ error, reset }: Readonly<GlobalErrorBoundaryProps>) {
  useEffect(() => {
    if (!posthog.__loaded) {
      return
    }
    // The digest matches `error.digest` on the server's request error log and
    // exception, joining the client and server sides of the same failure.
    posthog.captureException(error, {
      mechanism: 'react-error-boundary',
      ...(error.digest ? { digest: error.digest } : {}),
    })
  }, [error])

  return (
    <html lang='he' dir='rtl'>
      <body className='bg-background text-foreground antialiased'>
        <main className='mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center md:px-6'>
          <h1 className='font-semibold text-2xl md:text-3xl'>שגיאה לא צפויה באפליקציה</h1>
          <p className='max-w-lg text-muted-foreground text-sm md:text-base'>
            קרתה תקלה ברמת האפליקציה. אפשר לנסות שוב או לטעון את הדף מחדש.
          </p>
          {error.digest ? (
            <p className='rounded border border-border bg-muted px-3 py-2 font-mono text-xs'>
              מזהה שגיאה: {error.digest}
            </p>
          ) : null}
          <div className='flex flex-col gap-3 sm:flex-row'>
            <button
              type='button'
              className='rounded-md border border-border px-4 py-2 font-medium text-sm transition-colors hover:bg-muted'
              onClick={reset}
            >
              נסו שוב
            </button>
            <button
              type='button'
              className='rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:opacity-90'
              onClick={() => window.location.reload()}
            >
              טעינה מחדש
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
