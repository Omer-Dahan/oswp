import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import Link from 'next/link'
import { formatDateStandard } from '~/app/utils/helpers'
import { AureliaCoupleGallery, AureliaHeaderImage } from '~/templates/aurelia/components/media'
import { AureliaNavbar } from '~/templates/aurelia/components/navbar'
import { AureliaSections } from '~/templates/aurelia/components/sections'
import type { TemplateSurfaceProps } from '~/templates/types'

const headingFont = 'font-[family-name:var(--tpl-heading-font)]'

export async function AureliaHome({
  weddingData,
  path,
  introText,
  locale,
}: Readonly<TemplateSurfaceProps>) {
  const t = await getTranslations('template')
  const { website } = weddingData

  return (
    <main className='flex flex-col items-center gap-24 px-6 pb-28'>
      {website.headerImageUrl ? (
        <div className='w-full max-w-4xl pt-6'>
          <AureliaHeaderImage url={website.headerImageUrl} />
        </div>
      ) : null}
      <section className='relative flex w-full max-w-3xl flex-col items-center gap-8 pt-24 text-center'>
        <div
          aria-hidden
          className='absolute top-10 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 blur-3xl'
        />
        <p className='text-[1.05rem] text-accent uppercase tracking-[0.38em]'>
          {t('common.gettingMarried')}
        </p>
        <h1 className={`${headingFont} text-6xl text-foreground leading-tight sm:text-7xl ${locale === 'he' ? '' : 'italic'}`}>
          {weddingData.brideFirstName}
          <span className='mx-3 inline-block -translate-y-[0.08em] align-middle font-light text-[0.83em] text-primary not-italic'>&</span>
          {weddingData.groomFirstName}
        </h1>
        <div className='flex items-center gap-4 text-muted-foreground'>
          <span className='h-px w-12 bg-border' />
          <span className='text-xl uppercase tracking-[0.22em]'>
            {weddingData.date?.standardFormat ?? t('common.dateToBeAnnounced')}
          </span>
          <span className='h-px w-12 bg-border' />
        </div>
        {weddingData.daysRemaining > 0 && (
          <p className='text-muted-foreground text-xl tracking-[0.16em]'>
            {t('aurelia.daysToGo', { days: weddingData.daysRemaining })}
          </p>
        )}
        <AureliaNavbar path={path} isRsvpEnabled={website.isRsvpEnabled} />
        {website.isRsvpEnabled && (
          <Link
            href={`${path}/rsvp`}
            className='mt-2 rounded-full bg-primary px-12 py-4 text-base text-primary-foreground uppercase tracking-[0.22em] shadow-sm transition-colors hover:bg-accent'
          >
            {t('common.rsvp')}
          </Link>
        )}
      </section>

      {website.coverPhotoUrl && (
        <div className='relative h-96 w-full max-w-4xl overflow-hidden rounded-[28px] border border-border shadow-sm'>
          <Image
            src={website.coverPhotoUrl}
            fill
            sizes='(max-width: 768px) 100vw, 80vw'
            priority
            className='object-cover'
            alt={t('common.websiteCoverAlt')}
          />
        </div>
      )}

      {introText ? (
        <section className='max-w-2xl text-balance text-center text-lg text-muted-foreground leading-9'>
          <p>{introText}</p>
        </section>
      ) : null}

      <AureliaCoupleGallery urls={website.coupleImageUrls} />

      {weddingData.events.length > 0 && (
        <section className='grid w-full max-w-4xl gap-8 sm:grid-cols-2'>
          {weddingData.events.map((event) => (
            <div
              key={event.id}
              className='flex flex-col items-center gap-3 rounded-[20px] border border-border bg-card px-8 py-10 text-center text-card-foreground'
            >
              <h3 className={`${headingFont} text-4xl text-primary ${locale === 'he' ? '' : 'italic'}`}>{event.name}</h3>
              {!!event.date && (
                <span className='text-muted-foreground text-lg uppercase tracking-[0.14em]'>
                  {formatDateStandard(event.date, locale)}
                </span>
              )}
              {!!event.startTime && (
                <span className='text-muted-foreground text-xl'>
                  {event.startTime}
                  {!!event.endTime && ` – ${event.endTime}`}
                </span>
              )}
              {!!event.venue && (
                <span className='text-foreground text-lg uppercase tracking-[0.12em]'>
                  {event.venue}
                </span>
              )}
            </div>
          ))}
        </section>
      )}

      <AureliaSections sections={weddingData.sections} />

      <section className='flex flex-col items-center gap-3 text-center'>
        <p className={`${headingFont} text-5xl text-foreground ${locale === 'he' ? '' : 'italic'}`}>
          {weddingData.brideFirstName?.[0] ?? 'B'} &amp; {weddingData.groomFirstName?.[0] ?? 'G'}
        </p>
        <span className='h-px w-16 bg-border' />
        <p className='text-muted-foreground text-xl tracking-[0.22em]'>
          {weddingData.date.numberFormat?.toString() ?? t('common.dateToBeAnnounced')}
        </p>
      </section>
    </main>
  )
}
