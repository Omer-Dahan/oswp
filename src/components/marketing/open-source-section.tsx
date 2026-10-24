type OpenSourceSectionProps = {
  includeLongForm?: boolean
}

export default function OpenSourceSection({ includeLongForm = false }: OpenSourceSectionProps) {
  return (
    <section className='relative overflow-hidden bg-primary px-6 py-24 text-center'>
      <p className='mb-5 font-mono text-[0.63rem] text-white/55 uppercase tracking-[.2em]'>
        חינם וקוד פתוח
      </p>
      <h2 className='font-display font-normal text-[clamp(2rem,4vw,3rem)] text-white'>
        נבנה באהבה.
        <br />
        משותף עם כולם.
      </h2>
      <p className='mx-auto mt-5 max-w-lg font-light font-serif text-[1rem] text-white/70 leading-[1.75]'>
        OSWP זמינה בקוד פתוח תחת רישיון FSL-1.1 ונבנית בשקיפות מלאה. תנו כוכב, עשו fork, תרמו קוד,
        או אחסנו בעצמכם בחינם. בלי הגבלת אורחים. בלי אגירת מידע. Etta כלולה.
      </p>

      {includeLongForm ? (
        <div className='mx-auto mt-6 max-w-2xl space-y-3 text-start'>
          <p className='font-serif text-[0.95rem] text-white/80 leading-relaxed'>
            אנחנו בונים בשקיפות כך שזוגות ומתכננים יכולים לבדוק כל שינוי, להציע שיפורים, ולפרוס על
            תשתית שבשליטתם.
          </p>
          <p className='font-serif text-[0.95rem] text-white/80 leading-relaxed'>
            תרומות במוצר, בעיצוב, בתיעוד ובפיתוח מתקבלות בברכה דרך פרויקט ה-GitHub והדיונים בו.
          </p>
        </div>
      ) : null}

      <div className='mt-10 flex flex-wrap items-center justify-center gap-4'>
        <a
          href='https://github.com/dccakes/SCV'
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-2 rounded-sm bg-background px-7 py-3.5 font-mono text-[0.67rem] text-primary uppercase tracking-[.1em] transition-all hover:-translate-y-0.5 hover:opacity-90'
        >
          ⌘ כוכב ב-GitHub
        </a>
        <a
          href='https://github.com/dccakes/SCV/blob/main/CONTRIBUTING.md'
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-2 rounded-sm border border-white/35 px-7 py-3.5 font-mono text-[0.67rem] text-white uppercase tracking-[.1em] transition-all hover:-translate-y-0.5 hover:border-white'
        >
          מדריך לתרומה →
        </a>
        <a
          href='https://github.com/dccakes/SCV#self-hosting'
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-2 rounded-sm border border-white/35 px-7 py-3.5 font-mono text-[0.67rem] text-white uppercase tracking-[.1em] transition-all hover:-translate-y-0.5 hover:border-white'
        >
          תיעוד אירוח עצמי →
        </a>
      </div>
    </section>
  )
}
