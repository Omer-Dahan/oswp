import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

type ClassicNavbarProps = {
  path: string
  isRsvpEnabled: boolean
}

const getNavLinks = (isRsvpEnabled: boolean, t: Awaited<ReturnType<typeof getTranslations>>) => [
  { title: t('common.nav.home'), subPath: '', isVisible: true },
  // Guests reach their personalized save-the-date through their household link
  // (/w/[subUrl]/save-the-date/[token]), which sets a cookie and stays current as
  // details change. A token-less nav entry would only hit the invalid state, so
  // we keep this destination hidden from the public nav.
  { title: t('common.nav.saveTheDate'), subPath: '/save-the-date', isVisible: false },
  { title: t('common.nav.invitation'), subPath: '/invitation', isVisible: true },
  { title: t('common.nav.rsvp'), subPath: '/rsvp', isVisible: isRsvpEnabled },
]

export async function ClassicNavbar({ path, isRsvpEnabled }: Readonly<ClassicNavbarProps>) {
  const t = await getTranslations('template')
  return (
    <nav aria-label='Wedding website' className='mt-10 mb-5 w-full'>
      <ul className='flex w-full flex-col justify-center first:border-t sm:flex-row sm:gap-7 sm:border-none'>
        {getNavLinks(isRsvpEnabled, t)
          .filter((link) => link.isVisible)
          .map((link) => (
            <li
              key={link.subPath || 'home'}
              className='border-b py-3 sm:border-transparent sm:border-b-2 sm:py-1 sm:hover:border-gray-600'
            >
              <Link href={`${path}${link.subPath}`}>{link.title}</Link>
            </li>
          ))}
      </ul>
    </nav>
  )
}
