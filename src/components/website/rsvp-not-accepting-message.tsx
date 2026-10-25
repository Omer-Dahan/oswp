import { Clock } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { stepHeadingFont, stepPrimaryClassName } from '~/components/website/forms/steps/step-ui'

type RsvpNotAcceptingMessageProps = {
  basePath: string
}

export default async function RsvpNotAcceptingMessage({ basePath }: RsvpNotAcceptingMessageProps) {
  const t = await getTranslations('rsvp')

  return (
    <main className='flex min-h-screen items-center justify-center px-6 py-12'>
      <div className='flex w-full max-w-md flex-col items-center gap-6 rounded-[28px] border border-border bg-card px-8 py-12 text-center text-card-foreground shadow-sm sm:px-10'>
        <span className='inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary'>
          <Clock aria-hidden className='h-6 w-6' />
        </span>

        <div className='flex flex-col gap-2'>
          <h1 className={`${stepHeadingFont} text-2xl text-foreground sm:text-3xl`}>
            {t('notYetOpenTitle')}
          </h1>
          <p className='text-base text-muted-foreground leading-7'>{t('notYetOpenDescription')}</p>
        </div>

        <a href={basePath} className={`${stepPrimaryClassName} mt-2`}>
          {t('backToWedding')}
        </a>
      </div>
    </main>
  )
}
