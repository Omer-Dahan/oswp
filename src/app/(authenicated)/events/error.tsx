'use client'

type EventsErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function EventsError({ error, reset }: Readonly<EventsErrorProps>) {
  return (
    <div className='container mx-auto flex min-h-[50vh] flex-col items-center justify-center px-4 py-6 text-center md:py-8'>
      <h2 className='font-semibold text-xl md:text-2xl'>לא ניתן לטעון אירועים</h2>
      <p className='mt-2 max-w-md text-muted-foreground text-sm md:text-base'>
        נתקלנו בבעיה בטעינת האירועים שלכם. נסו שוב.
      </p>
      {error.digest ? (
        <p className='mt-3 rounded border border-border bg-muted px-3 py-2 font-mono text-xs'>
          מזהה שגיאה: {error.digest}
        </p>
      ) : null}
      <button
        type='button'
        onClick={reset}
        className='mt-4 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:opacity-90'
      >
        נסו שוב
      </button>
    </div>
  )
}
