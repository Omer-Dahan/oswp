/**
 * Aurelia template imagery: the header/hero banner shown at the top of every
 * surface, and the couple photo gallery shown on the home page. Both adopt
 * Aurelia's soft, rounded, bordered styling.
 */

import { getTranslations } from 'next-intl/server'
import Image from 'next/image'

export async function AureliaHeaderImage({ url }: { url: string | null }) {
  if (!url) {
    return null
  }
  const t = await getTranslations('template')
  return (
    <div className='relative aspect-[3/1] w-full max-w-4xl overflow-hidden rounded-[28px] border border-border shadow-sm'>
      <Image
        src={url}
        fill
        priority
        sizes='(max-width: 768px) 100vw, 80vw'
        className='object-cover object-center'
        alt={t('common.weddingHeaderAlt')}
      />
    </div>
  )
}

export async function AureliaCoupleGallery({ urls }: { urls: string[] }) {
  if (urls.length === 0) {
    return null
  }
  const t = await getTranslations('template')
  return (
    <section className='grid w-full max-w-4xl gap-4 sm:grid-cols-3'>
      {urls.map((url) => (
        <div
          key={url}
          className='relative aspect-square overflow-hidden rounded-[20px] border border-border shadow-sm'
        >
          <Image
            src={url}
            fill
            sizes='(max-width: 768px) 50vw, 33vw'
            className='object-cover'
            alt={t('common.theCoupleAlt')}
          />
        </div>
      ))}
    </section>
  )
}
