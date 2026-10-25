/**
 * Shared shell and primitives for the guest RSVP flow.
 *
 * Every step (find-your-invitation, confirm-name, event-rsvp, the question
 * steps, send-rsvp) and the confirmation/password/not-accepting screens in the
 * same family render through these, so the whole flow shares one type ramp,
 * one button language, and one spacing rhythm instead of each step inventing
 * its own. Colors and the heading font come from the active template's CSS
 * variables (`--primary`, `--tpl-heading-font`, …), so this file works
 * unchanged across every wedding template, not just Aurelia.
 */

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react'

export const stepHeadingFont = 'font-[family-name:var(--tpl-heading-font)]'

export function StepShell({ children }: { children: ReactNode }) {
  return <div className='flex flex-col gap-6'>{children}</div>
}

export function StepHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className={`${stepHeadingFont} text-2xl text-foreground leading-snug sm:text-3xl`}>
      {children}
    </h2>
  )
}

export function StepBody({ children }: { children: ReactNode }) {
  return <p className='text-base text-muted-foreground leading-7'>{children}</p>
}

export function StepField({
  label,
  htmlFor,
  children,
}: {
  label: ReactNode
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className='flex flex-col gap-2'>
      <label htmlFor={htmlFor} className='text-foreground/80 text-sm'>
        {label}
      </label>
      {children}
    </div>
  )
}

export function StepErrorText({ children }: { children: ReactNode }) {
  return (
    <p role='alert' className='text-destructive text-sm'>
      {children}
    </p>
  )
}

export function StepActions({ children }: { children: ReactNode }) {
  return <div className='flex flex-col gap-3 pt-2'>{children}</div>
}

const fieldClassName =
  'w-full rounded-[16px] border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function StepTextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-12 ${fieldClassName} ${className}`} />
}

export function StepTextArea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldClassName} py-3 ${className}`} />
}

// Exported as plain strings (not just the <button> components below) so the
// confirmation/password/not-accepting screens can apply the identical primary
// button language to a Next <Link> or a plain <a>.
export const stepPrimaryClassName =
  'inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-8 text-base text-primary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-muted'

export const stepSecondaryClassName =
  'inline-flex h-11 w-full items-center justify-center rounded-full px-6 text-base text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function StepPrimaryButton({
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type='button' {...props} className={`${stepPrimaryClassName} ${className}`}>
      {children}
    </button>
  )
}

export function StepStepperButton({
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type='button'
      {...props}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-input text-foreground text-lg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

export function StepSecondaryButton({
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type='button' {...props} className={`${stepSecondaryClassName} ${className}`}>
      {children}
    </button>
  )
}
