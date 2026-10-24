import Link from 'next/link'

type PricingSectionProps = {
  sectionId?: string
}

const freeFeatures = [
  'גישה לקוד המלא',
  'אורחים בלי הגבלה',
  'כל התכונות המרכזיות',
  'Etta (מביאים מפתח API משלכם)',
  'דומיין מותאם',
]

const freeMissing = ['אירוח מנוהל', 'גיבויים אוטומטיים', 'תמיכה בעדיפות']

const coupleFeatures = [
  'כל מה שיש ב-Community',
  'אירוח ענן מנוהל',
  'גיבויים אוטומטיים יומיים',
  'Etta כלולה',
  'הגדרת דומיין מותאם',
  'ניהול אמינות משלוח אימיילים',
  'שיחת קליטה',
]

const plannerFeatures = [
  'כל מה שיש ב-Couple',
  'עד 10 חתונות פעילות',
  'לוח בקרה למתכננים',
  'אפשרות White-label',
  'Etta לכל זוג',
  'תמיכה בעדיפות',
  'קליטה מלאה בליווי אישי',
  'התחייבות SLA',
]

export default function PricingSection({ sectionId }: PricingSectionProps) {
  return (
    <section
      id={sectionId}
      className='mx-auto w-full max-w-6xl border-border border-t px-6 py-28 md:px-12'
    >
      <p className='mb-3 flex items-center gap-3 font-mono text-[0.6rem] text-primary uppercase tracking-[.2em]'>
        <span className='block h-px w-5 bg-primary' />
        תמחור
      </p>
      <h2 className='font-display font-normal text-[clamp(2rem,4vw,3rem)] leading-[1.1] tracking-tight'>
        אירוח עצמי בחינם.
        <br />
        <em className='text-primary italic'>או תנו לנו לטפל בזה.</em>
      </h2>
      <p className='mt-5 max-w-xl font-light font-serif text-[1rem] text-muted-foreground leading-[1.75]'>
        הריצו את OSWP על התשתית שלכם לתמיד, או בחרו בענן המנוהל שלנו — בלי תפעול, בלי תחזוקה, רק
        החתונה שלכם.
      </p>

      <div className='mt-14 overflow-hidden rounded border border-border bg-border'>
        <div className='grid grid-cols-1 gap-px sm:grid-cols-3'>
          <div className='flex flex-col bg-background px-8 py-9 transition-colors hover:bg-muted/50'>
            <p className='mb-5 font-mono text-[0.57rem] text-muted-foreground uppercase tracking-[.18em]'>
              Community
            </p>
            <div className='mb-3 flex items-baseline gap-1.5'>
              <span className='font-serif text-[3rem] leading-none'>£0</span>
              <span className='font-mono text-[0.62rem] text-muted-foreground tracking-[.06em]'>
                לתמיד
              </span>
            </div>
            <p className='mb-6 min-h-[3.5rem] font-light font-serif text-[0.88rem] text-muted-foreground leading-relaxed'>
              פלטפורמת OSWP המלאה, באירוח עצמי על התשתית שלכם. בלי הגבלות, בלי תלות בספק.
            </p>
            <div className='my-5 h-px bg-border' />
            <ul className='mb-8 flex flex-1 flex-col gap-3'>
              {freeFeatures.map((item) => (
                <li
                  key={item}
                  className='flex items-center gap-2.5 font-mono text-[0.67rem] tracking-[.02em]'
                >
                  <span className='text-emerald-600'>✓</span> {item}
                </li>
              ))}
              {freeMissing.map((item) => (
                <li
                  key={item}
                  className='flex items-center gap-2.5 font-mono text-[0.67rem] text-muted-foreground/40 tracking-[.02em]'
                >
                  <span>-</span> {item}
                </li>
              ))}
            </ul>
            <a
              href='https://github.com/dccakes/SCV'
              target='_blank'
              rel='noopener noreferrer'
              className='mt-auto block rounded-sm border border-border py-3.5 text-center font-mono text-[0.67rem] text-foreground uppercase tracking-[.1em] transition-all hover:-translate-y-0.5 hover:border-foreground'
            >
              ⌘ פרסו בעצמכם →
            </a>
          </div>

          <div className='relative flex flex-col bg-foreground px-8 py-9 text-background'>
            <div className='absolute top-0 end-0 start-0 h-0.5 bg-gradient-to-r from-primary to-gold' />
            <p className='mb-5 font-mono text-[0.57rem] text-gold uppercase tracking-[.18em]'>
              Couple
            </p>
            <div className='mb-3 flex items-baseline gap-1.5'>
              <span className='font-serif text-[3rem] text-background leading-none'>£12</span>
              <span className='font-mono text-[0.62rem] text-background/40 tracking-[.06em]'>
                / לחודש
              </span>
            </div>
            <p className='mb-6 min-h-[3.5rem] font-light font-serif text-[0.88rem] text-background/55 leading-relaxed'>
              מנוהל במלואו. אנחנו מטפלים בשרתים, בגיבויים ובעדכונים כדי שתוכלו להתמקד בחתונה.
            </p>
            <div className='my-5 h-px bg-white/10' />
            <ul className='mb-8 flex flex-1 flex-col gap-3'>
              {coupleFeatures.map((item) => (
                <li
                  key={item}
                  className='flex items-center gap-2.5 font-mono text-[0.67rem] text-background/75 tracking-[.02em]'
                >
                  <span className='text-gold'>✓</span> {item}
                </li>
              ))}
              <li className='flex items-center gap-2.5 font-mono text-[0.67rem] text-background/25 tracking-[.02em]'>
                <span>-</span> ליווי קונסיירז׳ מלא
              </li>
            </ul>
            <Link
              href='/auth/signin'
              className='mt-auto block rounded-sm bg-primary py-3.5 text-center font-mono text-[0.67rem] text-background uppercase tracking-[.1em] transition-all hover:-translate-y-0.5 hover:bg-primary/90'
            >
              התחלת ניסיון חינם →
            </Link>
            <p className='mt-3 text-center font-mono text-[0.57rem] text-background/25 tracking-[.04em]'>
              14 יום ניסיון חינם · ביטול בכל עת
            </p>
          </div>

          <div className='flex flex-col bg-background px-8 py-9 transition-colors hover:bg-muted/50'>
            <p className='mb-5 font-mono text-[0.57rem] text-muted-foreground uppercase tracking-[.18em]'>
              Planner
            </p>
            <div className='mb-3 flex items-baseline gap-1.5'>
              <span className='font-serif text-[3rem] leading-none'>£49</span>
              <span className='font-mono text-[0.62rem] text-muted-foreground tracking-[.06em]'>
                / לחודש
              </span>
            </div>
            <p className='mb-6 min-h-[3.5rem] font-light font-serif text-[0.88rem] text-muted-foreground leading-relaxed'>
              למתכננות ומתכננים שמנהלים כמה זוגות. לוח בקרה אחד, אירועים מרובים, מוכן ל-White-label.
            </p>
            <div className='my-5 h-px bg-border' />
            <ul className='mb-8 flex flex-1 flex-col gap-3'>
              {plannerFeatures.map((item) => (
                <li
                  key={item}
                  className='flex items-center gap-2.5 font-mono text-[0.67rem] tracking-[.02em]'
                >
                  <span className='text-emerald-600'>✓</span> {item}
                </li>
              ))}
            </ul>
            <a
              href='mailto:hello@oswp.dev'
              className='mt-auto block rounded-sm border border-border py-3.5 text-center font-mono text-[0.67rem] text-foreground uppercase tracking-[.1em] transition-all hover:-translate-y-0.5 hover:border-foreground'
            >
              יצירת קשר →
            </a>
          </div>
        </div>
      </div>

      <p className='mt-12 text-center font-mono text-[0.63rem] text-muted-foreground leading-[1.9] tracking-[.04em]'>
        OSWP זמינה בקוד פתוח תחת רישיון FSL-1.1, אירוח עצמי חינם לתמיד, זכויות אירוח מסחרי שמורות.
        <br />
        אירוח הענן הוא איך שאנחנו מממנים פיתוח מתמשך.{' '}
        <a
          href='https://github.com/dccakes/SCV'
          target='_blank'
          rel='noopener noreferrer'
          className='border-transparent border-b text-primary transition-colors hover:border-primary'
        >
          קראו את הרישיון שלנו ↗
        </a>
      </p>
    </section>
  )
}
