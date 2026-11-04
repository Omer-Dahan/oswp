'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { StepFormProps } from '~/app/utils/shared-types'
import { useRsvpForm, useUpdateRsvpForm } from '~/components/contexts/rsvp-form-context'
import {
  StepActions,
  StepBody,
  StepErrorText,
  StepField,
  StepHeading,
  StepPrimaryButton,
  StepSecondaryButton,
  StepShell,
  StepStepperButton,
  StepTextInput,
} from '~/components/website/forms/steps/step-ui'
import { api } from '~/trpc/react'

type FindYourInvitationFormProps = StepFormProps & {
  /** Proves the guest already cleared this website's password gate, if any. */
  accessToken?: string
}

type SelfAddFieldErrors = Partial<Record<'fullName' | 'phone' | 'attendingCount', string>>

const MIN_SELF_ADD_ATTENDING = 1
const MAX_SELF_ADD_ATTENDING = 8

export default function FindYourInvitationForm({
  goNext,
  accessToken,
}: FindYourInvitationFormProps) {
  const t = useTranslations('rsvp')
  const tCommon = useTranslations('common')
  const { weddingData, declineIntent } = useRsvpForm()
  const updateRsvpForm = useUpdateRsvpForm()
  const [name, setName] = useState<string>('')
  const [showError, setShowError] = useState<boolean>(false)
  const [showSelfAddCta, setShowSelfAddCta] = useState<boolean>(false)
  const [showSelfAddForm, setShowSelfAddForm] = useState<boolean>(false)
  const [selfAddFullName, setSelfAddFullName] = useState<string>('')
  const [selfAddPhone, setSelfAddPhone] = useState<string>('')
  const [selfAddAttendingCount, setSelfAddAttendingCount] = useState<number>(
    MIN_SELF_ADD_ATTENDING
  )
  const [selfAddFieldErrors, setSelfAddFieldErrors] = useState<SelfAddFieldErrors>({})
  const [selfAddGeneralError, setSelfAddGeneralError] = useState<string | null>(null)
  const [selfAddAlreadyListedNote, setSelfAddAlreadyListedNote] = useState<string | null>(null)

  const subUrl = weddingData.website?.subUrl ?? ''
  const basePath = `/w/${subUrl}`

  const { refetch, isFetching } = api.household.findBySearchPublic.useQuery(
    { subUrl, searchText: name, accessToken },
    {
      enabled: false,
      retry: false,
    }
  )

  const selfAdd = api.household.addSelfPublic.useMutation({
    onSuccess: (result) => {
      setSelfAddGeneralError(null)
      setSelfAddFieldErrors({})
      // The invite link's own page (not a client-side route) owns the
      // "you're on the list" copy (greeting, date line, calendar/navigation
      // buttons), so a hard navigation there is the confirmation screen —
      // a router.push would leave this step mounted with stale local state.
      const inviteLink = `${basePath}/save-the-date/${encodeURIComponent(result.inviteCode)}`
      if (result.kind === 'already_listed') {
        setSelfAddAlreadyListedNote(t('selfAddAlreadyListed'))
      }
      window.location.assign(inviteLink)
    },
    onError: (err) => {
      const zodFieldErrors = (
        err.data as { zodError?: { fieldErrors?: Record<string, string[]> } } | null | undefined
      )?.zodError?.fieldErrors
      if (zodFieldErrors) {
        setSelfAddFieldErrors({
          fullName: zodFieldErrors.fullName?.[0],
          phone: zodFieldErrors.phone?.[0],
          attendingCount: zodFieldErrors.attendingCount?.[0],
        })
        setSelfAddGeneralError(null)
      } else {
        setSelfAddFieldErrors({})
        setSelfAddGeneralError(err.message || tCommon('genericError'))
      }
    },
  })

  const handleOnSearch = () => {
    // the method to conditionally execute client db queries?
    void refetch().then((res) => {
      // Only advance when the search actually returned households. Guarding on
      // presence (not just length) keeps an errored or empty response on this
      // step showing the retry hint, instead of dropping the guest onto a blank
      // confirm screen with no names to pick.
      if (res.error) {
        setShowError(true)
        setShowSelfAddCta(false)
      } else if (!res.data || res.data.length === 0) {
        setShowError(true)
        setShowSelfAddCta(true)
      } else {
        setShowError(false)
        setShowSelfAddCta(false)
        updateRsvpForm({ matchedHouseholds: res.data, searchText: name })
        goNext?.()
      }
    })
  }

  const handleSelfAddSubmit = () => {
    selfAdd.mutate({
      subUrl,
      fullName: selfAddFullName.trim(),
      phone: selfAddPhone.trim(),
      attendingCount: selfAddAttendingCount,
    })
  }

  return (
    <StepShell>
      <StepHeading>
        {t('weddingTitle', {
          brideFirstName: weddingData.brideFirstName ?? '',
          groomFirstName: weddingData.groomFirstName ?? '',
        })}
      </StepHeading>
      <StepBody>{declineIntent ? t('groupNoteDecline') : t('groupNote')}</StepBody>
      <StepField label={t('fullNamePlaceholder')} htmlFor='rsvp-guest-name'>
        <StepTextInput
          id='rsvp-guest-name'
          placeholder={t('fullNamePlaceholder')}
          onChange={(e) => {
            setShowError(false)
            setShowSelfAddCta(false)
            setShowSelfAddForm(false)
            setName(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (name.length > 0 && !isFetching) handleOnSearch()
          }}
          value={name}
          enterKeyHint='search'
        />
      </StepField>
      {showError && <StepErrorText>{t('notFound')}</StepErrorText>}
      <StepActions>
        <StepPrimaryButton disabled={name.length === 0 || isFetching} onClick={handleOnSearch}>
          {isFetching ? tCommon('searching') : t('findInvitation')}
        </StepPrimaryButton>
      </StepActions>

      {showSelfAddCta && !showSelfAddForm && (
        <StepSecondaryButton
          className='w-auto justify-start ps-0'
          onClick={() => setShowSelfAddForm(true)}
        >
          {t('selfAddCta')}
        </StepSecondaryButton>
      )}

      {showSelfAddForm && (
        <div className='flex flex-col gap-6 border-border border-t pt-6'>
          <StepField label={t('selfAddFullNameLabel')} htmlFor='self-add-full-name'>
            <StepTextInput
              id='self-add-full-name'
              placeholder={t('selfAddFullNameLabel')}
              value={selfAddFullName}
              onChange={(e) => setSelfAddFullName(e.target.value)}
            />
            {selfAddFieldErrors.fullName && (
              <StepErrorText>{selfAddFieldErrors.fullName}</StepErrorText>
            )}
          </StepField>

          <StepField label={t('selfAddPhoneLabel')} htmlFor='self-add-phone'>
            <StepTextInput
              id='self-add-phone'
              type='tel'
              placeholder={t('selfAddPhoneLabel')}
              value={selfAddPhone}
              onChange={(e) => setSelfAddPhone(e.target.value)}
            />
            {selfAddFieldErrors.phone && <StepErrorText>{selfAddFieldErrors.phone}</StepErrorText>}
          </StepField>

          <StepField label={t('selfAddAttendingCountLabel')} htmlFor='self-add-attending-count'>
            <div className='flex items-center gap-4'>
              <StepStepperButton
                aria-label='הפחתת מספר המגיעים'
                disabled={selfAddAttendingCount <= MIN_SELF_ADD_ATTENDING}
                onClick={() =>
                  setSelfAddAttendingCount((value) =>
                    Math.max(MIN_SELF_ADD_ATTENDING, value - 1)
                  )
                }
              >
                −
              </StepStepperButton>
              <span
                id='self-add-attending-count'
                className='w-6 text-center text-base text-foreground tabular-nums'
              >
                {selfAddAttendingCount}
              </span>
              <StepStepperButton
                aria-label='הוספת מגיע'
                disabled={selfAddAttendingCount >= MAX_SELF_ADD_ATTENDING}
                onClick={() =>
                  setSelfAddAttendingCount((value) =>
                    Math.min(MAX_SELF_ADD_ATTENDING, value + 1)
                  )
                }
              >
                +
              </StepStepperButton>
            </div>
            {selfAddFieldErrors.attendingCount && (
              <StepErrorText>{selfAddFieldErrors.attendingCount}</StepErrorText>
            )}
          </StepField>

          {selfAddGeneralError && <StepErrorText>{selfAddGeneralError}</StepErrorText>}
          {selfAddAlreadyListedNote && <StepBody>{selfAddAlreadyListedNote}</StepBody>}

          <StepActions>
            <StepPrimaryButton
              disabled={
                selfAdd.isPending ||
                selfAddFullName.trim().length === 0 ||
                selfAddPhone.trim().length === 0
              }
              onClick={handleSelfAddSubmit}
            >
              {selfAdd.isPending ? tCommon('searching') : t('selfAddSubmit')}
            </StepPrimaryButton>
          </StepActions>
        </div>
      )}
    </StepShell>
  )
}
