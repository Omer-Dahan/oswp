import Link from 'next/link'

import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

export function WebsiteDisabledCallout() {
  return (
    <Card className='border-border/80 border-dashed bg-card/80'>
      <CardHeader className='space-y-3'>
        <p className='font-mono text-[0.62rem] text-foreground/45 uppercase tracking-[0.18em]'>
          בונה האתרים כבוי
        </p>
        <CardTitle className='font-display text-3xl text-foreground'>
          הפעילו את תוסף אתר החתונה הציבורי כדי להתחיל לערוך.
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-5'>
        <p className='max-w-2xl font-sans text-muted-foreground text-sm leading-6'>
          לאחר ההפעלה, סביבת העבודה תקבל עורך ייעודי לאתר החתונה וכתובת ציבורית לאורחים שאפשר
          לשתף.
        </p>
        <Button asChild>
          <Link href='/settings#plugins'>פתיחת הגדרות התוספים</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
