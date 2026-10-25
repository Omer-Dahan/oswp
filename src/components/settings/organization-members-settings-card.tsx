'use client'

import { Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { authClient } from '~/lib/auth-client'
import {
  getOrganizationRoleLabel,
  type OrganizationRoleOption,
  organizationRoleOptions,
} from '~/lib/organization-roles'
import { getUserInitials } from '~/lib/user-display'
import { api } from '~/trpc/react'

type Organization = {
  id: string
  name?: string | null
}

type Member = {
  id: string
  role: string
  user?: {
    email?: string | null
    image?: string | null
    name?: string | null
  } | null
}

type DisplayMember = {
  id: string
  role: string
  side: string | null
  name: string | null
  email: string | null
  canEditRole: boolean
  canRemove: boolean
}

type OrganizationState = {
  canUpdateMembers: boolean
  error: string | null
  isLoading: boolean
  members: Member[]
  organization: Organization | null
}

type AuthFetchError = {
  message?: string | null
}

type AuthFetchResult<T> = {
  data: T | null
  error?: AuthFetchError | null
}

type FullOrganizationResponse = Organization & {
  members?: Member[]
}

type HasPermissionResponse = {
  success: boolean
}

const initialState: OrganizationState = {
  canUpdateMembers: false,
  error: null,
  isLoading: true,
  members: [],
  organization: null,
}

function getRoleLabel(role: string) {
  return getOrganizationRoleLabel(role)
}

function getInitials(name?: string | null, email?: string | null) {
  if (!name?.trim() && !email?.trim()) {
    return '?'
  }

  return getUserInitials(name, email)
}

async function authGet<T>(path: string, fallbackMessage: string): Promise<T> {
  const result = (await authClient.$fetch(path)) as AuthFetchResult<T>

  if (result.error) {
    throw new Error(fallbackMessage)
  }

  if (!result.data) {
    throw new Error(fallbackMessage)
  }

  return result.data
}

async function authPost<T>(
  path: string,
  body: Record<string, unknown>,
  fallbackMessage: string
): Promise<T> {
  const result = (await authClient.$fetch(path, {
    body,
    method: 'POST',
  })) as AuthFetchResult<T>

  if (result.error) {
    throw new Error(fallbackMessage)
  }

  if (!result.data) {
    throw new Error(fallbackMessage)
  }

  return result.data
}

async function fetchOrganizationState(): Promise<Omit<OrganizationState, 'error' | 'isLoading'>> {
  const organization = await authGet<FullOrganizationResponse>(
    '/organization/get-full-organization',
    'לא ניתן לטעון את הארגון.'
  )

  if (!organization?.id) {
    throw new Error('לא נמצא ארגון פעיל.')
  }

  const updateMemberPermissionResult = await authPost<HasPermissionResponse>(
    '/organization/has-permission',
    {
      organizationId: organization.id,
      permissions: {
        member: ['update'],
      },
    },
    'לא ניתן לטעון הרשאות חבר.'
  )

  return {
    canUpdateMembers: !!updateMemberPermissionResult.success,
    members: organization.members ?? [],
    organization,
  }
}

export function OrganizationMembersSettingsCard() {
  const [state, setState] = useState<OrganizationState>(initialState)
  const [roleDialogMember, setRoleDialogMember] = useState<Member | null>(null)

  const loadOrganizationState = useCallback(() => {
    let isActive = true

    setState((current) => ({
      ...current,
      error: null,
      isLoading: true,
    }))

    void fetchOrganizationState()
      .then((nextState) => {
        if (!isActive) return
        setState({
          ...nextState,
          error: null,
          isLoading: false,
        })
      })
      .catch((error: unknown) => {
        if (!isActive) return
        setState({
          canUpdateMembers: false,
          error: error instanceof Error ? error.message : 'לא ניתן לטעון את חברי הארגון.',
          isLoading: false,
          members: [],
          organization: null,
        })
      })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => loadOrganizationState(), [loadOrganizationState])

  const needsFallback = !state.isLoading && (!!state.error || state.members.length === 0)

  const fallbackMembersQuery = api.workspaceInvite.listMembers.useQuery(undefined, {
    enabled: needsFallback,
  })

  const displayMembers: DisplayMember[] = useMemo(() => {
    if (!needsFallback) {
      return state.members.map((member) => ({
        id: member.id,
        role: member.role,
        side: null,
        name: member.user?.name ?? null,
        email: member.user?.email ?? null,
        canEditRole: state.canUpdateMembers,
        canRemove: state.canUpdateMembers,
      }))
    }

    return (fallbackMembersQuery.data ?? []).map((member) => ({
      id: member.id,
      role: member.role,
      side: member.side,
      name: member.user.name,
      email: member.user.email,
      canEditRole: false,
      canRemove: false,
    }))
  }, [fallbackMembersQuery.data, needsFallback, state.canUpdateMembers, state.members])

  const isLoading = state.isLoading || (needsFallback && fallbackMembersQuery.isLoading)

  const handleRefresh = useCallback(() => {
    loadOrganizationState()
    void fallbackMembersQuery.refetch()
  }, [fallbackMembersQuery, loadOrganizationState])

  return (
    <div className='rounded-xl border border-border/90 bg-card/85 p-1'>
      <Card className='border-0 bg-transparent shadow-none'>
        <CardHeader className='pb-2'>
          <div className='flex items-start justify-between gap-3'>
            <div className='space-y-1'>
              <CardTitle className='font-serif text-foreground text-xl'>חברים</CardTitle>
              <CardDescription className='text-foreground/70'>
                נהלו מי יכול לגשת לסביבת העבודה של החתונה הזו.
              </CardDescription>
            </div>
            <Button className='gap-2' onClick={handleRefresh} size='sm' type='button' variant='outline'>
              <RefreshCw className='h-4 w-4' />
              רענון
            </Button>
          </div>
        </CardHeader>
        <CardContent className='pt-2'>
          <div className='space-y-3'>
            <p className='text-foreground/60 text-sm'>
              להוספת משתתפים השתמשו בקישורי ההזמנה.
            </p>
            {isLoading ? (
              <OrganizationMembersLoadingState />
            ) : (
              <OrganizationMembersList
                members={displayMembers}
                onEditRole={setRoleDialogMember}
                onRemoveMember={async (member) => {
                  if (!state.organization) return false

                  try {
                    await authPost(
                      '/organization/remove-member',
                      {
                        memberIdOrEmail: member.id,
                        organizationId: state.organization.id,
                      },
                      'לא ניתן להסיר את החבר.'
                    )
                    toast.success('החבר הוסר')
                    loadOrganizationState()
                    return true
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'לא ניתן להסיר את החבר.')
                    return false
                  }
                }}
              />
            )}
          </div>
        </CardContent>
      </Card>
      {state.organization && roleDialogMember ? (
        <EditMemberRoleDialog
          member={roleDialogMember}
          onRoleUpdated={() => {
            setRoleDialogMember(null)
            loadOrganizationState()
          }}
          open={!!roleDialogMember}
          onOpenChange={(open) => {
            if (!open) {
              setRoleDialogMember(null)
            }
          }}
          organizationId={state.organization.id}
        />
      ) : null}
    </div>
  )
}

function OrganizationMembersLoadingState() {
  return (
    <div
      className='flex min-h-32 items-center justify-center rounded-lg border border-border/70 border-dashed bg-background/40'
      role='status'
    >
      <div className='flex items-center gap-2 text-foreground/70 text-sm'>
        <Loader2 className='h-4 w-4 animate-spin' />
        טוען חברי ארגון...
      </div>
    </div>
  )
}

function OrganizationMembersList({
  members,
  onEditRole,
  onRemoveMember,
}: {
  members: DisplayMember[]
  onEditRole: (member: Member) => void
  onRemoveMember: (member: DisplayMember) => Promise<boolean>
}) {
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<DisplayMember | null>(null)
  const [removalConfirmation, setRemovalConfirmation] = useState('')

  const canConfirmRemoval = removalConfirmation.trim() === 'מחיקה'

  if (members.length === 0) {
    return (
      <div className='rounded-lg border border-border/70 border-dashed bg-background/40 p-4 text-foreground/65 text-sm'>
        אין עדיין משתתפים — צרו קישור הזמנה כדי להוסיף.
      </div>
    )
  }

  return (
    <div className='grid gap-4'>
      {members
        .slice()
        .sort((left, right) => {
          const leftName = left.name || left.email || ''
          const rightName = right.name || right.email || ''
          return leftName.localeCompare(rightName)
        })
        .map((member) => (
          <div
            className='flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-background/55 px-4 py-3'
            key={member.id}
          >
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-mono font-semibold text-primary text-xs uppercase'>
              {getInitials(member.name, member.email)}
            </div>
            <div className='min-w-0 flex-1'>
              <p className='truncate font-medium text-foreground text-sm'>
                {member.name || member.email || 'חבר לא ידוע'}
              </p>
              <p className='truncate text-foreground/60 text-sm'>
                {member.email || 'אין כתובת אימייל'}
              </p>
            </div>
            <Badge variant='outline'>{getRoleLabel(member.role)}</Badge>
            {member.side ? <Badge variant='outline'>{member.side}</Badge> : null}
            {member.canEditRole ? (
              <Button
                onClick={() => onEditRole({ id: member.id, role: member.role })}
                size='sm'
                type='button'
                variant='outline'
              >
                עריכת תפקיד
              </Button>
            ) : null}
            {member.canRemove ? (
              <Button
                aria-label={`הסרת ${member.name || member.email || 'חבר'}`}
                className='h-8 w-8'
                disabled={removingMemberId === member.id}
                onClick={() => {
                  setMemberPendingRemoval(member)
                  setRemovalConfirmation('')
                }}
                size='icon'
                type='button'
                variant='outline'
              >
                {removingMemberId === member.id ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Trash2 className='h-4 w-4 text-destructive' />
                )}
              </Button>
            ) : null}
          </div>
        ))}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setMemberPendingRemoval(null)
            setRemovalConfirmation('')
          }
        }}
        open={!!memberPendingRemoval}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>אישור הסרת חבר</DialogTitle>
            <DialogDescription>
              הקלידו מחיקה כדי לאשר הסרת{' '}
              {memberPendingRemoval?.name || memberPendingRemoval?.email || 'חבר זה'}.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2'>
            <label
              className='font-medium text-foreground text-sm'
              htmlFor='remove-member-confirmation'
            >
              אישור
            </label>
            <Input
              id='remove-member-confirmation'
              onChange={(event) => setRemovalConfirmation(event.target.value)}
              placeholder='מחיקה'
              value={removalConfirmation}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setMemberPendingRemoval(null)
                setRemovalConfirmation('')
              }}
              type='button'
              variant='outline'
            >
              ביטול
            </Button>
            <Button
              disabled={!canConfirmRemoval || !memberPendingRemoval || !!removingMemberId}
              onClick={() => {
                if (!memberPendingRemoval) return
                const targetMember = memberPendingRemoval

                setRemovingMemberId(targetMember.id)
                void onRemoveMember(targetMember)
                  .then((wasRemoved) => {
                    if (wasRemoved) {
                      setMemberPendingRemoval(null)
                      setRemovalConfirmation('')
                    }
                  })
                  .finally(() =>
                    setRemovingMemberId((current) => (current === targetMember.id ? null : current))
                  )
              }}
              type='button'
              variant='destructive'
            >
              הסרת חבר
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EditMemberRoleDialog({
  member,
  onOpenChange,
  onRoleUpdated,
  open,
  organizationId,
}: {
  member: Member
  onOpenChange: (open: boolean) => void
  onRoleUpdated: () => void
  open: boolean
  organizationId: string
}) {
  const [role, setRole] = useState<OrganizationRoleOption>(
    (member.role as OrganizationRoleOption) || 'member'
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setRole((member.role as OrganizationRoleOption) || 'member')
    setIsSubmitting(false)
  }, [member])

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)

    try {
      await authPost(
        '/organization/update-member-role',
        {
          memberId: member.id,
          organizationId,
          role,
        },
        'לא ניתן לעדכן את תפקיד החבר.'
      )

      toast.success('תפקיד החבר עודכן')
      onRoleUpdated()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'לא ניתן לעדכן את תפקיד החבר.')
      setIsSubmitting(false)
    }
  }, [member.id, onOpenChange, onRoleUpdated, organizationId, role])

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>ערכו תפקיד</DialogTitle>
          <DialogDescription>עדכנו את התפקיד בארגון עבור חבר זה.</DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='space-y-2'>
            <label
              className='font-medium text-foreground text-sm'
              htmlFor='organization-member-role'
            >
              תפקיד החבר
            </label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as OrganizationRoleOption)}
            >
              <SelectTrigger id='organization-member-role' aria-label='תפקיד חבר'>
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
          <div className='flex justify-end gap-2'>
            <Button onClick={() => onOpenChange(false)} type='button' variant='outline'>
              ביטול
            </Button>
            <Button disabled={isSubmitting} onClick={() => void handleSubmit()} type='button'>
              {isSubmitting ? (
                <>
                  <Loader2 className='me-2 h-4 w-4 animate-spin' />
                  שומר...
                </>
              ) : (
                'שמירת תפקיד'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
