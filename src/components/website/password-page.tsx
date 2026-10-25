'use client'

import { Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import {
  StepTextInput,
  stepHeadingFont,
  stepPrimaryClassName,
} from '~/components/website/forms/steps/step-ui'

type PasswordPageProps = {
  verifyWebsitePassword: (passwordInput: string) => Promise<boolean>
}

export default function PasswordPage({ verifyWebsitePassword }: PasswordPageProps) {
  const [passwordInput, setPasswordInput] = useState('')
  const [showError, setShowError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const t = useTranslations('common')

  const verifyPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    const isVerified = await verifyWebsitePassword(passwordInput)

    if (!isVerified) {
      setShowError(true)
      setIsSubmitting(false)
      return
    }

    router.refresh()
  }

  return (
    <main className='flex min-h-screen items-center justify-center px-6 py-12'>
      <form
        className='flex w-full max-w-md flex-col items-center gap-6 rounded-[28px] border border-border bg-card px-8 py-12 text-center text-card-foreground shadow-sm sm:px-10'
        onSubmit={(event) => void verifyPassword(event)}
      >
        <span className='inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary'>
          <Lock aria-hidden className='h-6 w-6' />
        </span>

        <div className='flex flex-col gap-2'>
          <h1 className={`${stepHeadingFont} text-2xl text-foreground sm:text-3xl`}>
            {t('passwordProtected')}
          </h1>
          <p className='text-base text-muted-foreground leading-7'>{t('passwordProtectedHint')}</p>
        </div>

        <div className='flex w-full flex-col gap-2 text-start'>
          <label className='text-foreground/80 text-sm' htmlFor='website-password'>
            {t('password')}
          </label>
          <StepTextInput
            aria-describedby={showError ? 'website-password-error' : undefined}
            autoComplete='current-password'
            autoFocus
            id='website-password'
            name='password'
            onChange={(event) => {
              setShowError(false)
              setPasswordInput(event.target.value)
            }}
            placeholder={t('passwordPlaceholder')}
            spellCheck={false}
            type='password'
            value={passwordInput}
          />
        </div>

        <button className={stepPrimaryClassName} disabled={isSubmitting} type='submit'>
          {isSubmitting ? t('unlocking') : t('unlockSite')}
        </button>

        <p
          aria-live='polite'
          className='min-h-5 text-destructive text-sm'
          id='website-password-error'
        >
          {showError ? t('incorrectPassword') : null}
        </p>
      </form>
    </main>
  )
}
