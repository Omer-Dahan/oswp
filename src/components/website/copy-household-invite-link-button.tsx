'use client'

import { useCallback, useState } from 'react'

type CopyHouseholdInviteLinkButtonProps = {
  /** The household's own save-the-date invite code, e.g. `/w/<sub>/save-the-date/<code>`. */
  websiteSubUrl: string
  inviteCode: string
}

const copyToClipboard = async (value: string): Promise<boolean> => {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Fall through to the legacy selection path below.
    }
  }

  const textArea = document.createElement('textarea')
  textArea.value = value
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  document.body.removeChild(textArea)
  return copied
}

/** Quiet secondary action: copies the household's own dedicated invite link. */
export function CopyHouseholdInviteLinkButton({
  websiteSubUrl,
  inviteCode,
}: Readonly<CopyHouseholdInviteLinkButtonProps>) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const link = `${window.location.origin}/w/${websiteSubUrl}/save-the-date/${inviteCode}`
    const didCopy = await copyToClipboard(link)
    if (!didCopy) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }, [websiteSubUrl, inviteCode])

  return (
    <button
      type='button'
      onClick={handleCopy}
      aria-label='העתקת קישור אישי למשק הבית'
      className='inline-flex h-11 items-center justify-center rounded-full border border-foreground/15 bg-transparent px-4 font-sans text-foreground/70 text-xs transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97]'
    >
      {copied ? 'הועתק' : 'העתקת קישור'}
    </button>
  )
}
