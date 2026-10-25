import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import Link from 'next/link'
import { formatDateStandard } from '~/app/utils/helpers'
import { coupleInitials, coupleNames } from '~/lib/wedding/couple-name'
import { ClassicCoupleGallery, ClassicHeaderImage } from '~/templates/classic/components/media'
import { ClassicNavbar } from '~/templates/classic/components/navbar'
import { ClassicSections } from '~/templates/classic/components/sections'
import type { TemplateSurfaceProps } from '~/templates/types'

export async function ClassicHomeMobile({
  weddingData,
  path,
  introText,
}: Readonly<TemplateSurfaceProps>) {
  const t = await getTranslations('template')
  const { website } = weddingData

  return (
    <main className='flex flex-col items-center justify-center gap-20 pb-24 text-center text-zinc-500 tracking-widest'>
      <ClassicHeaderImage url={website.headerImageUrl} />
      <div className='text-center'>
        <h1 className='my-5 font-medium text-6xl tracking-widest'>{coupleNames(weddingData)}</h1>
        <p className='text-lg'>
          {weddingData.date?.standardFormat ?? t('common.dateToBeAnnounced')}
        </p>
        {weddingData.daysRemaining > 0 && (
          <p className='text-lg'>{t('classic.daysToGo', { days: weddingData.daysRemaining })}</p>
        )}
        {website.isRsvpEnabled && (
          <Link
            href={`${path}/rsvp`}
            className='mt-5 inline-block rounded-sm bg-primary px-6 py-3 text-primary-foreground tracking-widest hover:bg-pink-500 hover:underline'
          >
            {t('common.rsvp')}
          </Link>
        )}
      </div>

      {website.coverPhotoUrl && (
        <div className='relative h-80 w-full px-10'>
          <Image
            src={website.coverPhotoUrl}
            fill
            sizes='100vw'
            priority
            className='object-contain'
            alt={t('common.websiteCoverAlt')}
          />
        </div>
      )}

      {introText ? (
        <section className='max-w-2xl text-balance px-6 text-lg leading-8 tracking-normal'>
          <p>{introText}</p>
        </section>
      ) : null}

      <ClassicCoupleGallery urls={website.coupleImageUrls} />

      {weddingData.events.map((event) => (
        <div key={event.id} className='flex flex-col gap-2'>
          <h3 className='text-4xl tracking-widest'>{event.name.toLowerCase()}</h3>
          {!!event.date && (
            <span className='font-thin text-2xl'>{formatDateStandard(event.date)}</span>
          )}
          {!!event.startTime && (
            <span className='font-thin text-2xl'>
              {event.startTime}
              {!!event.endTime && ` - ${event.endTime}`}
            </span>
          )}
        </div>
      ))}

      <ClassicSections sections={weddingData.sections} />

      <ClassicNavbar path={path} isRsvpEnabled={website.isRsvpEnabled} />

      <div className='text-center'>
        <h2 className='border-black border-b px-5 pb-6 text-6xl'>
          {coupleInitials(weddingData) ?? 'G & B'}
        </h2>
        <p className='mt-4 text-lg tracking-widest'>
          {weddingData.date.numberFormat?.toString() ?? t('common.dateToBeAnnounced')}
        </p>
      </div>
    </main>
  )
}
