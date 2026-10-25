'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { authClient } from '~/lib/auth-client'
import { api } from '~/trpc/react'

const SIDE_OPTIONS = [
  { value: 'כלה', label: 'כלה' },
  { value: 'חתן', label: 'חתן' },
  { value: 'אחר', label: 'אחר' },
] as const

const REASON_TEXT: Record<string, string> = {
  not_found: 'הקישור אינו קיים',
  revoked: 'הקישור בוטל',
  expired: 'תוקף הקישור פג',
  used_up: 'הקישור מוצה',
}

const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'יש להזין שם מלא'),
  email: z.string().trim().min(1, 'יש להזין דוא"ל').email('כתובת דוא"ל לא תקינה'),
  password: z.string().min(8, 'הסיסמה חייבת להיות באורך 8 תווים לפחות'),
  side: z.enum(['כלה', 'חתן', 'אחר'], { message: 'יש לבחור צד' }),
})

type SignupFormData = z.infer<typeof signupSchema>

export function TeamSignupForm({ token }: { token: string }) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', side: undefined },
  })

  const acceptMutation = api.workspaceInvite.accept.useMutation({
    onSuccess: async (result, variables) => {
      if (result.ok) {
        const signInResult = await authClient.signIn.email({
          email: variables.email,
          password: variables.password,
        })
        if (signInResult.error) {
          setFormError('ההרשמה הצליחה אך ההתחברות נכשלה — נסו להתחבר ידנית')
          return
        }
        router.push('/dashboard')
        return
      }

      if (result.error === 'email_exists') {
        setFormError('email_exists')
        return
      }

      setFormError(REASON_TEXT[result.error] ?? 'אירעה שגיאה, נסו שוב')
    },
    onError: () => {
      setFormError('אירעה שגיאה, נסו שוב')
    },
  })

  const onSubmit = (data: SignupFormData) => {
    setFormError(null)
    acceptMutation.mutate({
      token,
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      side: data.side,
    })
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className='flex w-full max-w-md flex-col gap-5 text-right'
    >
      <div className='space-y-2'>
        <Label htmlFor='fullName'>שם מלא</Label>
        <Input
          id='fullName'
          {...register('fullName')}
          className={errors.fullName ? 'border-destructive' : ''}
        />
        {errors.fullName && <p className='text-destructive text-sm'>{errors.fullName.message}</p>}
      </div>

      <div className='space-y-2'>
        <Label htmlFor='email'>דוא&quot;ל</Label>
        <Input
          id='email'
          type='email'
          {...register('email')}
          className={errors.email ? 'border-destructive' : ''}
        />
        {errors.email && <p className='text-destructive text-sm'>{errors.email.message}</p>}
      </div>

      <div className='space-y-2'>
        <Label htmlFor='password'>סיסמה</Label>
        <Input
          id='password'
          type='password'
          dir='ltr'
          {...register('password')}
          className={errors.password ? 'border-destructive' : ''}
        />
        {errors.password && <p className='text-destructive text-sm'>{errors.password.message}</p>}
      </div>

      <div className='space-y-2'>
        <Label>הצד שלכם</Label>
        <Controller
          name='side'
          control={control}
          render={({ field }) => (
            <div className='grid grid-cols-3 gap-2'>
              {SIDE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm transition-colors ${
                    field.value === option.value
                      ? 'border-primary bg-primary/10 font-medium'
                      : 'border-input hover:bg-muted'
                  }`}
                >
                  <input
                    type='radio'
                    name='side'
                    value={option.value}
                    checked={field.value === option.value}
                    onChange={() => field.onChange(option.value)}
                    className='sr-only'
                  />
                  {option.label}
                </label>
              ))}
            </div>
          )}
        />
        {errors.side && <p className='text-destructive text-sm'>{errors.side.message}</p>}
      </div>

      {formError === 'email_exists' ? (
        <p className='text-destructive text-sm'>
          כתובת הדוא&quot;ל הזו כבר רשומה —{' '}
          <Link href='/auth/sign-in' className='underline-offset-4 hover:underline'>
            אפשר להתחבר
          </Link>
        </p>
      ) : formError ? (
        <p className='text-destructive text-sm'>{formError}</p>
      ) : null}

      <Button type='submit' disabled={acceptMutation.isPending} className='mt-2'>
        {acceptMutation.isPending ? 'מצטרפים...' : 'הצטרפות'}
      </Button>
    </form>
  )
}
