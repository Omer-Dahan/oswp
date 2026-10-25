'use client'

import { Copy, Link2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  getOrganizationRoleLabel,
  type OrganizationRoleOption,
  organizationRoleOptions,
} from '~/lib/organization-roles'
import { api } from '~/trpc/react'

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium' }).format(new Date(value))
}

function buildInviteUrl(token: string): string {
  if (typeof window === 'undefined') return `/team/${token}`
  return `${window.location.origin}/team/${token}`
}

function CopyLinkInput({ token }: { token: string }) {
  const url = buildInviteUrl(token)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('הקישור הועתק')
    } catch {
      toast.error('לא ניתן להעתיק את הקישור')
    }
  }

  return (
    <div className='flex min-w-0 flex-1 items-center gap-2'>
      <Input className='min-w-0 font-mono text-xs' dir='ltr' readOnly value={url} />
      <Button onClick={() => void handleCopy()} size='sm' type='button' variant='outline'>
        <Copy className='h-4 w-4' />
        העתקה
      </Button>
    </div>
  )
}

export function WorkspaceInviteLinksCard({ canManageMembers }: { canManageMembers: boolean }) {
  const [label, setLabel] = useState('')
  const [role, setRole] = useState<OrganizationRoleOption>('family')

  const { data: links, error, isLoading, refetch } = api.workspaceInvite.list.useQuery()

  const createLink = api.workspaceInvite.create.useMutation({
    onSuccess: () => {
      setLabel('')
      void refetch()
      toast.success('הקישור נוצר')
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || 'לא ניתן ליצור קישור')
    },
  })

  const revokeLink = api.workspaceInvite.revoke.useMutation({
    onSuccess: () => {
      void refetch()
      toast.success('הקישור בוטל')
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || 'לא ניתן לבטל את הקישור')
    },
  })

  return (
    <div className='rounded-xl border border-border/90 bg-card/85 p-1'>
      <Card className='border-0 bg-transparent shadow-none'>
        <CardHeader className='pb-2'>
          <div className='space-y-1'>
            <CardTitle className='font-serif text-foreground text-xl'>קישורי הזמנה</CardTitle>
            <CardDescription className='text-foreground/70'>
              קישור אחד לכל מי שאתם רוצים שיעזור. מי שנכנס דרכו נרשם לבד, בוחר את הצד שלו, ומקבל
              גישה לסביבת העבודה.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className='space-y-4 pt-2'>
          {canManageMembers ? (
            <div className='flex flex-wrap items-end gap-2 rounded-lg border border-border/70 bg-background/55 p-3'>
              <div className='min-w-40 flex-1 space-y-1.5'>
                <label className='font-medium text-foreground text-sm' htmlFor='invite-link-label'>
                  תיאור
                </label>
                <Input
                  id='invite-link-label'
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder='אבא של הכלה'
                  value={label}
                />
              </div>
              <div className='min-w-32 space-y-1.5'>
                <label className='font-medium text-foreground text-sm' htmlFor='invite-link-role'>
                  תפקיד
                </label>
                <Select
                  onValueChange={(value) => setRole(value as OrganizationRoleOption)}
                  value={role}
                >
                  <SelectTrigger id='invite-link-role' aria-label='תפקיד'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {organizationRoleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className='gap-2'
                disabled={createLink.isPending}
                onClick={() =>
                  createLink.mutate({
                    label: label.trim() || null,
                    role,
                  })
                }
                size='sm'
                type='button'
              >
                {createLink.isPending ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Link2 className='h-4 w-4' />
                )}
                יצירת קישור
              </Button>
            </div>
          ) : (
            <p className='text-foreground/60 text-sm'>
              התפקיד שלכם אינו מאפשר ליצור או לבטל קישורי הזמנה.
            </p>
          )}

          {isLoading ? (
            <div
              className='flex min-h-20 items-center justify-center rounded-lg border border-border/70 border-dashed bg-background/40'
              role='status'
            >
              <div className='flex items-center gap-2 text-foreground/70 text-sm'>
                <Loader2 className='h-4 w-4 animate-spin' />
                טוען קישורי הזמנה...
              </div>
            </div>
          ) : null}

          {!isLoading && error ? (
            <p className='text-foreground/60 text-sm'>לא ניתן לטעון את קישורי ההזמנה.</p>
          ) : null}

          {!isLoading && !error && links ? (
            links.length === 0 ? (
              <div className='rounded-lg border border-border/70 border-dashed bg-background/40 p-4 text-foreground/65 text-sm'>
                אין עדיין קישורי הזמנה.
              </div>
            ) : (
              <div className='grid gap-3'>
                {links.map((link) => {
                  const isRevoked = !!link.revokedAt
                  const isExpired = !!link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()
                  const isUsedUp = link.maxUses !== null && link.usedCount >= link.maxUses
                  const isLive = !isRevoked && !isExpired && !isUsedUp

                  return (
                    <div
                      className='flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-background/55 px-4 py-3'
                      key={link.id}
                    >
                      <div className='min-w-0 flex-1 space-y-1'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <p className='truncate font-medium text-foreground text-sm'>
                            {link.label || 'קישור הזמנה'}
                          </p>
                          <Badge variant='outline'>{getOrganizationRoleLabel(link.role)}</Badge>
                          {isRevoked ? <Badge variant='outline'>בוטל</Badge> : null}
                          {!isRevoked && isExpired ? <Badge variant='outline'>פג תוקף</Badge> : null}
                          {!isRevoked && !isExpired && isUsedUp ? (
                            <Badge variant='outline'>נוצל במלואו</Badge>
                          ) : null}
                        </div>
                        <p className='text-foreground/60 text-xs'>
                          נוצר {formatDate(link.createdAt)} · {link.usedCount} שימושים
                          {link.maxUses !== null ? ` מתוך ${link.maxUses}` : ''}
                        </p>
                        {isLive ? <CopyLinkInput token={link.token} /> : null}
                      </div>
                      {canManageMembers && isLive ? (
                        <Button
                          disabled={revokeLink.isPending}
                          onClick={() => revokeLink.mutate({ id: link.id })}
                          size='sm'
                          type='button'
                          variant='outline'
                        >
                          ביטול
                        </Button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
