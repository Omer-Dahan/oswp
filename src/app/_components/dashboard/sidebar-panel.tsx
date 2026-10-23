import { Lock, Palette, Users } from 'lucide-react'
import Link from 'next/link'
import type { Dispatch, SetStateAction } from 'react'

import { Card, CardContent } from '~/components/ui/card'

type SidebarPanelProps = {
  setShowWebsiteSettings: Dispatch<SetStateAction<boolean>>
}

export default function SidebarPanel({ setShowWebsiteSettings }: SidebarPanelProps) {
  return (
    <section className='mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3'>
      <Card className='border bg-card shadow-sm'>
        <CardContent className='p-6'>
          <div className='mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10'>
            <Palette className='h-4 w-4 text-primary' />
          </div>
          <h2 className='font-semibold text-foreground'>ערכת העיצוב שלכם</h2>
          <p className='mt-1 text-muted-foreground text-xs'>התאימו את מראה האתר שלכם</p>
          <button type='button' className='mt-3 text-primary text-sm hover:underline'>
            עיון בערכות עיצוב →
          </button>
        </CardContent>
      </Card>

      <Card className='border bg-card shadow-sm'>
        <CardContent className='p-6'>
          <div className='mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10'>
            <Users className='h-4 w-4 text-primary' />
          </div>
          <h2 className='font-semibold text-foreground'>רשימת אורחים</h2>
          <p className='mt-1 text-muted-foreground text-xs'>נהלו משקי בית ואישורי הגעה</p>
          <Link href='/guest-list' className='mt-3 block text-primary text-sm hover:underline'>
            ניהול →
          </Link>
        </CardContent>
      </Card>

      <Card className='border bg-card shadow-sm'>
        <CardContent className='p-6'>
          <div className='mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10'>
            <Lock className='h-4 w-4 text-primary' />
          </div>
          <h2 className='font-semibold text-foreground'>הגדרות פרטיות</h2>
          <p className='mt-1 text-muted-foreground text-xs'>שלטו בגישה לאתר</p>
          <button
            type='button'
            className='mt-3 text-primary text-sm hover:underline'
            onClick={() => setShowWebsiteSettings(true)}
          >
            ניהול →
          </button>
        </CardContent>
      </Card>
    </section>
  )
}
