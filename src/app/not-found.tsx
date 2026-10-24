import Link from 'next/link'
import { sharedStyles } from '~/app/utils/shared-styles'

export default function NotFoundPage() {
  return (
    <div className='flex min-h-screen items-center justify-center px-4'>
      <div className='flex max-w-xl flex-col gap-5 py-16 text-center'>
        <h1 className='pb-5 font-bold text-7xl'>הדף לא נמצא</h1>
        <p>מצטערים, נראה שהגעתם לדף שלא קיים.</p>
        <div className='py-10'>
          <Link href='/' className={`p-5 ${sharedStyles.primaryButton()}`}>
            לדף הבית
          </Link>
        </div>
        <p>
          צריכים עזרה? <span className='underline'>חפשו במרכז העזרה או פנו אלינו.</span>
        </p>
      </div>
    </div>
  )
}
