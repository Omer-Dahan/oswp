import Link from 'next/link'

import { SignInButton } from '~/components/auth-buttons'
import MobileNav from '~/components/home/mobile-nav'
import OpenSourceSection from '~/components/marketing/open-source-section'
import PricingSection from '~/components/marketing/pricing-section'

const features = [
  {
    n: '01',
    icon: '✉',
    title: 'הזמנות חכמות',
    desc: 'שלחו הזמנות דיגיטליות מעוצבות עם קישורים אישיים לכל אורח, מעקב פתיחה, ותזכורות אוטומטיות למי שלא פתח.',
    tag: 'מנוע אישורי הגעה',
  },
  {
    n: '02',
    icon: '◉',
    title: 'ניהול אישורי הגעה',
    desc: 'מעקב תגובות בזמן אמת עם העדפות תזונה, מלווים, הושבה, ורשימות אורחים לייצוא.',
    tag: 'זמן אמת',
  },
  {
    n: '03',
    icon: '◈',
    title: 'לוח תכנון',
    desc: 'ניהול ספקים, מעקב משימות, תקציב ותצוגות ציר זמן — הכול בסביבת תכנון אחת מאוחדת.',
    tag: 'ציר זמן',
  },
  {
    n: '04',
    icon: '⊹',
    title: 'הושבה ולוגיסטיקה',
    desc: 'סידורי הושבה בגרירה ושחרור שמתחשבים בהעדפות תזונה, קשרים ודינמיקות משפחתיות. כולל הצעה אוטומטית.',
    tag: 'הצעה אוטומטית',
  },
  {
    n: '05',
    icon: '◐',
    title: 'מרכז ספקים',
    desc: 'ריכזו חוזים, תשלומים, פרטי קשר ומועדים לכל ספק. תקבלו תזכורת לפני שמשהו נשמט.',
    tag: 'תזכורות',
  },
  {
    n: '06',
    icon: '✦',
    title: 'אתר חתונה',
    desc: 'פרסמו אתר חתונה מותאם עם אישור הגעה בתוך דקות. עיצובים, דומיין מותאם, ושילוב רשימת מתנות.',
    tag: 'דומיין מותאם',
  },
]

const stack = [
  {
    layer: 'תשתית',
    name: 'Next.js 15 + React 19',
    detail: 'App Router · Server Components · tRPC v11',
  },
  {
    layer: 'מסד נתונים',
    name: 'PostgreSQL · Prisma v7',
    detail: 'ORM בטוח-טיפוסים · מביאים אירוח משלכם',
  },
  {
    layer: 'Etta / בינה מלאכותית',
    name: 'Claude / OpenAI',
    detail: 'שימוש בכלים · פעולות אוטונומיות · מתחבר לכל ספק',
  },
  {
    layer: 'אימייל והזמנות',
    name: 'Resend · React Email',
    detail: 'תבניות בטוחות-טיפוסים · מביאים שולח משלכם',
  },
  { layer: 'אימות', name: 'Better Auth', detail: 'קישורי קסם לאורחים · OAuth למנהלים' },
  {
    layer: 'פריסה',
    name: 'Vercel · Docker · אירוח עצמי',
    detail: 'פריסה בלחיצה אחת · מוכן ל-Edge',
  },
]

const ettaExamples = [
  '"מי עוד לא אישר הגעה? שלחי להם תזכורת."',
  '"מה נשאר לשלם למעצב הפרחים?"',
  '"הכיני סידור הושבה, תשמרי על בני הזוג לשעבר בנפרד."',
  '"סכמי את כל האימיילים מהספקים מהשבוע הזה."',
  '"אנחנו חורגים מהתקציב? מה אפשר לצמצם?"',
]

const navLinks = [
  { href: '#features', label: 'תכונות' },
  { href: '#etta', label: 'Etta AI' },
  { href: '/blog', label: 'בלוג' },
  { href: '#pricing', label: 'תמחור' },
  {
    href: 'https://github.com/dccakes/SCV',
    label: 'GitHub ↗',
    external: true,
  },
]

export default function NonAuthenticatedView() {
  return (
    <>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .cur { display:inline-block; width:8px; height:14px; background:rgba(255,255,255,.65); vertical-align:middle; animation:blink 1.1s step-end infinite; }
        @keyframes float { 0%,100%{transform:translateY(0) rotate(-.3deg)} 50%{transform:translateY(-10px) rotate(.3deg)} }
        .term-float { animation:float 6s ease-in-out infinite; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        .fu  { animation:fadeUp .75s ease both; }
        .fu1 { animation-delay:.12s; }
        .fu2 { animation-delay:.26s; }
        .fu3 { animation-delay:.40s; }
        @keyframes statusPulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        .status-dot { animation:statusPulse 2s infinite; }
        html { scroll-padding-top:72px; }
      `}</style>

      <div className='overflow-x-hidden bg-background text-foreground'>
        {/* ── NAV ─────────────────────────────────────────────── */}
        <nav className='fixed top-0 end-0 start-0 z-50 flex items-center justify-between border-border border-b bg-background/90 px-6 py-4 backdrop-blur-md md:px-12'>
          <Link
            href='/'
            className='flex items-center gap-1 font-medium font-mono text-[0.82rem] text-foreground uppercase tracking-[.2em]'
          >
            OSWP
            <span className='ms-0.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-super' />
          </Link>

          <ul className='hidden items-center gap-7 md:flex'>
            {navLinks.map(({ href, label, external }) => (
              <li key={label}>
                <a
                  href={href}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noopener noreferrer' : undefined}
                  className='font-mono text-[0.65rem] text-muted-foreground uppercase tracking-[.12em] transition-colors hover:text-foreground'
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>

          <div className='hidden md:block'>
            <SignInButton />
          </div>
          <MobileNav links={navLinks} />
        </nav>

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className='grid min-h-screen grid-cols-1 pt-16 md:grid-cols-2'>
          <div className='flex flex-col justify-center px-6 py-24 md:px-12 md:py-20'>
            <p className='fu mb-6 flex items-center gap-3 font-mono text-[0.62rem] text-primary uppercase tracking-[.2em]'>
              <span className='block h-px w-7 bg-primary' />
              פלטפורמת חתונות בקוד פתוח
            </p>
            <h1 className='fu fu1 font-display font-normal text-[clamp(3rem,5.5vw,5rem)] leading-[1.06] tracking-tight'>
              ה <em className='text-primary italic'>infrastructure</em>
              <br />
              לנצח שלכם
            </h1>
            <p className='fu fu2 mt-6 max-w-md font-light font-serif text-[1.05rem] text-muted-foreground leading-[1.75]'>
              פלטפורמת אירוח עצמי עם כל מה שהחתונה שלכם צריכה — הזמנות, אישורי הגעה, תכנון, ו-Etta,
              מתכננת החתונה החכמה שלכם, חושבת איתכם בכל שלב.
            </p>
            <div className='fu fu3 mt-10 flex flex-wrap items-center gap-5'>
              <Link
                href='/auth/signin'
                className='inline-flex items-center gap-2 rounded-sm bg-foreground px-6 py-3.5 font-mono text-[0.68rem] text-background uppercase tracking-[.1em] transition-all hover:-translate-y-0.5 hover:bg-primary'
              >
                ⌘ התחילו עכשיו
              </Link>
              <a
                href='#features'
                className='inline-flex items-center gap-1.5 border-transparent border-b font-mono text-[0.68rem] text-muted-foreground uppercase tracking-[.1em] transition-colors hover:border-foreground hover:text-foreground'
              >
                גלו את התכונות →
              </a>
            </div>
          </div>

          {/* Terminal */}
          <div className='fu fu2 flex items-center justify-center px-6 py-16 md:px-10'>
            <div className='term-float w-full max-w-[500px] overflow-hidden rounded-lg bg-foreground shadow-2xl'>
              <div className='flex items-center gap-1.5 border-white/5 border-b bg-white/[.03] px-4 py-3'>
                <span className='h-2.5 w-2.5 rounded-full bg-[#FF5F57]' />
                <span className='h-2.5 w-2.5 rounded-full bg-[#FFBD2E]' />
                <span className='h-2.5 w-2.5 rounded-full bg-[#28C840]' />
                <span className='mx-auto translate-x-5 font-mono text-[0.58rem] text-white/25 tracking-[.1em]'>
                  OSWP — bash
                </span>
              </div>
              <div className='px-5 py-5 font-mono text-[0.74rem] leading-[1.9]'>
                <p className='text-white/25'># פרסו את פלטפורמת החתונה שלכם</p>
                <p className='mt-2'>
                  <span className='me-2 text-white/20'>›</span>
                  <span className='text-[#E5C07B]'>npx</span>{' '}
                  <span className='text-[#98C379]'>create-oswp-app</span>
                </p>
                <p className='text-white/55'>{'  '}✦ מקימים את האירוע שלכם...</p>
                <p className='text-white/55'>{'  '}✦ מגדירים את מנוע ההזמנות</p>
                <p className='text-white/55'>{'  '}✦ מחברים webhooks לאישורי הגעה</p>
                <p className='mt-2'>
                  <span className='me-2 text-white/20'>›</span>
                  <span className='text-[#E5C07B]'>oswp</span>{' '}
                  <span className='text-[#98C379]'>invite</span>{' '}
                  <span className='text-[#C678DD]'>--template botanical</span>
                </p>
                <p className='text-[#61AFEF]'>{'  '}→ נוספו 127 אורחים</p>
                <p className='text-[#61AFEF]'>{'  '}→ נוצרו קישורים אישיים</p>
                <p className='mt-2'>
                  <span className='me-2 text-white/20'>›</span>
                  <span className='text-[#E5C07B]'>etta</span>{' '}
                  <span className='text-[#C678DD]'>״מי עוד לא אישר הגעה?״</span>
                </p>
                <p className='text-[#E06C75]'>{'  '}✦ Etta חושבת...</p>
                <p className='text-white/55'>{'  '}23 אורחים בהמתנה — רוצים</p>
                <p className='pb-4 text-white/55'>
                  {'  '}שאשלח להם תזכורת עדינה?
                  <span className='cur' />
                </p>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className='col-span-full flex flex-wrap border-border border-t'>
            {[
              { n: '∞', label: 'קיבולת אורחים' },
              { n: '100%', label: 'ניתן לאירוח עצמי' },
              { n: '0', label: 'תלות בספק' },
              { n: 'FSL', label: 'רישיון קוד פתוח' },
            ].map(({ n, label }, i) => (
              <div
                key={label}
                className={`flex flex-1 basis-1/2 items-baseline gap-2.5 px-6 py-6 md:basis-0 ${i < 3 ? 'border-border border-e' : ''}`}
              >
                <span className='font-serif text-[2rem] leading-none'>{n}</span>
                <span className='font-mono text-[0.6rem] text-muted-foreground uppercase tracking-[.12em]'>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── FEATURES ─────────────────────────────────────────── */}
        <section id='features' className='mx-auto w-full max-w-6xl px-6 py-28 md:px-12'>
          <p className='mb-3 flex items-center gap-3 font-mono text-[0.6rem] text-primary uppercase tracking-[.2em]'>
            <span className='block h-px w-5 bg-primary' />
            מה בפנים
          </p>
          <h2 className='font-display font-normal text-[clamp(2rem,4vw,3rem)] leading-[1.1] tracking-tight'>
            כל מה שצריך,
            <br />
            <em className='text-primary italic'>בלי מה שלא</em>
          </h2>

          <div className='mt-14 overflow-hidden rounded border border-border bg-border'>
            <div className='grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3'>
              {features.map((f) => (
                <div
                  key={f.n}
                  className='group relative overflow-hidden bg-background px-8 py-10 transition-colors hover:bg-muted/50'
                >
                  <span className='pointer-events-none absolute top-4 end-5 font-serif text-[4.5rem] text-foreground/[.04] leading-none transition-colors group-hover:text-primary/[.07]'>
                    {f.n}
                  </span>
                  <span className='mb-5 block text-[1.35rem]'>{f.icon}</span>
                  <h3 className='mb-2 font-serif text-[1.2rem] leading-snug'>{f.title}</h3>
                  <p className='font-light font-serif text-[0.9rem] text-muted-foreground leading-[1.65]'>
                    {f.desc}
                  </p>
                  <span className='mt-5 inline-block rounded-sm bg-emerald-500/10 px-2.5 py-1 font-mono text-[0.57rem] text-emerald-600 uppercase tracking-[.1em]'>
                    {f.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <p className='py-2 text-center font-serif text-[1.1rem] text-muted-foreground/35 tracking-[.8em]'>
          ❧ ✦ ❧
        </p>

        {/* ── ETTA ─────────────────────────────────────────────── */}
        <section id='etta' className='bg-foreground py-28 text-background'>
          <div className='mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 md:grid-cols-2 md:px-12'>
            <div>
              <p className='mb-3 flex items-center gap-3 font-mono text-[0.6rem] text-gold uppercase tracking-[.2em]'>
                <span className='block h-px w-5 bg-gold' />
                הכירו את Etta
              </p>
              <h2 className='font-display font-normal text-[clamp(2rem,4vw,3rem)] text-background leading-[1.1] tracking-tight'>
                מתכננת החתונה
                <br />
                <em className='text-gold italic'>החכמה שלכם, Etta</em>
              </h2>
              <p className='mt-6 max-w-md font-light font-serif text-[1rem] text-background/60 leading-[1.75]'>
                Etta היא מתכננת החתונה המובנית של OSWP, מבוססת בינה מלאכותית. היא חיה בתוך נתוני
                התכנון שלכם, מכירה את החתונה שלכם מקצה לקצה, ויכולה לבצע פעולות בעצמה — לא רק לענות
                על שאלות.
              </p>
              <ul className='mt-8 flex flex-col gap-3.5'>
                {ettaExamples.map((q) => (
                  <li
                    key={q}
                    className='flex items-start gap-3 font-mono text-[0.73rem] text-background/60 tracking-[.02em]'
                  >
                    <span className='mt-px flex-shrink-0 text-gold'>→</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>

            {/* Chat widget */}
            <div className='overflow-hidden rounded-lg border border-white/10 bg-white/[.04]'>
              <div className='flex items-center gap-3 border-white/10 border-b px-5 py-4'>
                <div className='flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gold to-primary font-serif text-[1rem] text-background italic'>
                  E
                </div>
                <div>
                  <span className='font-serif text-[0.95rem] text-background/95 italic'>Etta</span>
                  <span className='ms-1.5 font-mono text-[0.57rem] text-background/35 tracking-[.08em]'>
                    · OSWP AI Planner
                  </span>
                </div>
                <div className='ms-auto flex items-center gap-1.5 font-mono text-[0.57rem] text-emerald-400'>
                  <span className='status-dot h-1.5 w-1.5 rounded-full bg-emerald-400' />
                  מחוברת
                </div>
              </div>

              <div className='flex flex-col gap-4 p-5'>
                <div>
                  <div className='ms-auto max-w-[85%] rounded rounded-ee-none bg-white/[.07] px-4 py-3 font-serif text-[0.84rem] text-background/80 italic leading-relaxed'>
                    "נשארו 3 שבועות. מה הכי דחוף?"
                  </div>
                  <p className='mt-1 text-end font-mono text-[0.57rem] text-background/25'>
                    אתם · הרגע
                  </p>
                </div>
                <div>
                  <div className='me-auto max-w-[85%] rounded rounded-es-none border border-gold/20 bg-gold/10 px-4 py-3 font-serif text-[0.84rem] text-background/80 leading-relaxed'>
                    בוחנת את ציר הזמן שלכם — 3 דברים דורשים התייחסות: כמות המוזמנים לקייטרינג נדרשת
                    ביום שישי, 12 אורחים לא אישרו הגעה, והמקדמה לארוחת החזרה מאוחרת ב-4 ימים. רוצים
                    שאטפל באחד מהם?
                  </div>
                  <p className='mt-1 font-mono text-[0.57rem] text-background/25'>Etta · הרגע</p>
                </div>
                <div>
                  <div className='ms-auto max-w-[85%] rounded rounded-ee-none bg-white/[.07] px-4 py-3 font-serif text-[0.84rem] text-background/80 italic leading-relaxed'>
                    "כן, תזכירי לאורחים ותסמני את המקדמה."
                  </div>
                  <p className='mt-1 text-end font-mono text-[0.57rem] text-background/25'>
                    אתם · הרגע
                  </p>
                </div>
                <div>
                  <div className='me-auto max-w-[85%] rounded rounded-es-none border border-gold/20 bg-gold/10 px-4 py-3 font-serif text-[0.84rem] text-background/80 leading-relaxed'>
                    שלחתי תזכורות ל-12 אורחים עם ההודעה המותאמת שלכם. שלחתי במייל תזכורת למקדמה של
                    Rosewood — להוסיף אותה ללוח הדחוף שלכם?
                  </div>
                  <p className='mt-1 font-mono text-[0.57rem] text-background/25'>Etta · הרגע</p>
                </div>
              </div>

              <div className='flex items-center gap-3 border-white/10 border-t px-5 py-3'>
                <input
                  type='text'
                  placeholder='שאלו את Etta כל דבר…'
                  readOnly
                  className='flex-1 bg-transparent font-serif text-[0.82rem] text-background/35 italic outline-none placeholder:text-background/35'
                />
                <div className='flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[0.65rem] text-background'>
                  →
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── ARCHITECTURE ─────────────────────────────────────── */}
        <section
          id='stack'
          className='mx-auto w-full max-w-6xl border-border border-t px-6 py-28 md:px-12'
        >
          <div className='mb-14 grid grid-cols-1 items-end gap-10 md:grid-cols-2'>
            <div>
              <p className='mb-3 flex items-center gap-3 font-mono text-[0.6rem] text-primary uppercase tracking-[.2em]'>
                <span className='block h-px w-5 bg-primary' />
                בנוי למפתחים
              </p>
              <h2 className='font-display font-normal text-[clamp(2rem,4vw,3rem)] leading-[1.1] tracking-tight'>
                בקאנד שאתם
                <br />
                <em className='text-primary italic'>באמת שולטים בו</em>
              </h2>
            </div>
            <p className='font-light font-serif text-[0.95rem] text-muted-foreground leading-[1.75]'>
              OSWP היא אפליקציית Next.js 15 לאירוח עצמי עם API מבוסס tRPC בטוח-טיפוסים. מביאים מסד
              נתונים, ענן וספק בינה מלאכותית משלכם. הכול מודולרי, מתועד, ומוכן להרחבה.
            </p>
          </div>

          <div className='overflow-hidden rounded border border-border bg-border'>
            <div className='grid grid-cols-1 gap-px sm:grid-cols-2'>
              {stack.map((s) => (
                <div
                  key={s.layer}
                  className='bg-background px-6 py-6 transition-colors hover:bg-muted/50'
                >
                  <p className='mb-1 font-mono text-[0.57rem] text-emerald-600 uppercase tracking-[.15em]'>
                    {s.layer}
                  </p>
                  <p className='font-serif text-[1.1rem]'>{s.name}</p>
                  <p className='mt-0.5 font-mono text-[0.62rem] text-muted-foreground tracking-[.04em]'>
                    {s.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <PricingSection sectionId='pricing' />

        <OpenSourceSection />

        {/* ── FOOTER ───────────────────────────────────────────── */}
        <footer className='mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 border-border border-t px-6 py-8 sm:flex-row md:px-12'>
          <Link
            href='/'
            className='font-medium font-mono text-[0.78rem] text-foreground uppercase tracking-[.2em]'
          >
            OSWP
          </Link>
          <p className='font-mono text-[0.6rem] text-muted-foreground tracking-[.08em]'>
            רישיון FSL-1.1 · נבנה בכוונה
          </p>
          <ul className='flex gap-6'>
            {[
              { label: 'תיעוד', href: 'https://github.com/dccakes/SCV#readme' },
              { label: 'GitHub', href: 'https://github.com/dccakes/SCV' },
              { label: 'Discord', href: 'https://github.com/dccakes/SCV/discussions' },
              { label: 'בלוג', href: '/blog' },
              { label: 'יומן שינויים', href: '/blog?tag=changelog' },
            ].map(({ label, href }) => (
              <li key={label}>
                <a
                  href={href}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='font-mono text-[0.6rem] text-muted-foreground uppercase tracking-[.1em] transition-colors hover:text-foreground'
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </footer>
      </div>
    </>
  )
}
