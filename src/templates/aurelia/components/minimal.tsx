import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { TemplateMinimalProps } from '~/templates/types'

export async function AureliaMinimal({
  coupleNames,
  isRsvpEnabled,
  path,
}: Readonly<TemplateMinimalProps>) {
  const t = await getTranslations('template')
  return (
    <main className='flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center'>
      <p className='text-[0.7rem] text-accent uppercase tracking-[0.45em]'>
        {t('common.gettingMarried')}
      </p>
      <h1 className='font-[family-name:var(--tpl-heading-font)] text-5xl text-foreground italic sm:text-6xl'>
        {coupleNames}
      </h1>
      <span className='h-px w-16 bg-border' />
      {isRsvpEnabled ? (
        <Link
          href={`${path}/rsvp`}
          className='rounded-full bg-primary px-9 py-3 text-[0.72rem] text-primary-foreground uppercase tracking-[0.3em] transition-colors hover:bg-accent'
        >
          {t('common.rsvp')}
        </Link>
      ) : null}
    </main>
  )
}
