import { useRouter } from 'next/navigation'
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { BiPencil } from 'react-icons/bi'
import { toast } from 'sonner'
import { formatDateStandard } from '~/app/utils/helpers'
import type { Event, EventFormData, FormInvites } from '~/app/utils/shared-types'
import { useToggleEventForm } from '~/components/contexts/event-form-context'
import { useToggleGuestForm } from '~/components/contexts/guest-form-context'
import type { HouseholdFormData } from '~/components/forms/guest-form.schema'
import {
  type DrawerDraft,
  GuestDetailPanelContent,
} from '~/components/guest-list/guest-detail-panel-content'
import GuestSearchFilter from '~/components/guest-list/guest-search-filter'
import type { HouseholdMemberDraft } from '~/components/guest-list/household-members-modal'
import { GuestDetailDrawer } from '~/components/guest-list/v2/drawer/guest-detail-drawer'
import { GuestCardsList } from '~/components/guest-list/v2/list/guest-cards-list'
import { GuestIndividualTable } from '~/components/guest-list/v2/list/guest-individual-table'
import {
  ListToolbar,
  type ViewMode,
  type WorkflowMode,
} from '~/components/guest-list/v2/list/list-toolbar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { AsyncState } from '~/components/ui/async-state'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useWorkspace } from '~/hooks/use-workspace'
import { getHouseholdPartySize } from '~/lib/household-party-size'
import { normalizePhoneToE164 } from '~/lib/phone/phone-validator'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'
import { api } from '~/trpc/react'

const partySize = getHouseholdPartySize

type GuestsViewProps = {
  events: Event[]
  households: HouseholdWithGuests[]
  allHouseholds?: HouseholdWithGuests[]
  selectedEventId: string
  setPrefillHousehold: Dispatch<SetStateAction<HouseholdFormData | undefined>>
  setPrefillEvent: Dispatch<SetStateAction<EventFormData | undefined>>
  onImportClick: () => void
}

export default function GuestsView({
  events,
  households,
  allHouseholds = households,
  selectedEventId,
  setPrefillHousehold,
  setPrefillEvent,
  onImportClick,
}: GuestsViewProps) {
  const utils = api.useUtils()
  const { workspace } = useWorkspace()
  const { data: allTags = [] } = api.guestTag.getAll.useQuery()
  const toggleGuestForm = useToggleGuestForm()
  const [filteredHouseholds, setFilteredHouseholds] = useState(households)
  const [nameSort, setNameSort] = useState<'none' | 'ascending' | 'descending'>('none')
  const [partySort, setPartySort] = useState<'none' | 'ascending' | 'descending'>('none')
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | undefined>()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('households')
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [showDeleteHouseholdDialog, setShowDeleteHouseholdDialog] = useState(false)
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false)
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('')
  const [editingSections, setEditingSections] = useState<
    Set<'contactAddress' | 'notes' | 'sideGroup'>
  >(new Set())
  const [drawerDraft, setDrawerDraft] = useState<DrawerDraft>({
    email: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    notes: '',
    likelihoodOfAttending: null,
    side: '',
    groupName: '',
  })
  const [drawerBaseline, setDrawerBaseline] = useState<DrawerDraft>({
    email: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    notes: '',
    likelihoodOfAttending: null,
    side: '',
    groupName: '',
  })
  const initializedDrawerHouseholdIdRef = useRef<string | undefined>(undefined)

  const { totalGuests, totalTagAlongs } = useMemo(() => {
    let guests = 0
    let tagAlongs = 0
    for (const household of filteredHouseholds ?? []) {
      guests += partySize(household) ?? 0
      for (const guest of household.guests) {
        if (guest.isTagAlong) tagAlongs += 1
      }
    }
    return { totalGuests: guests, totalTagAlongs: tagAlongs }
  }, [filteredHouseholds])

  const totalUnfilteredGuests = useMemo(
    () => households.reduce((sum, household) => sum + (partySize(household) ?? 0), 0),
    [households]
  )

  useEffect(() => {
    setFilteredHouseholds(households)
  }, [households])

  const sortByName = useCallback(() => {
    setNameSort((previous) => {
      if (previous === 'none') return 'ascending'
      if (previous === 'ascending') return 'descending'
      return 'none'
    })
    setPartySort('none')
  }, [])

  const sortByParty = useCallback(() => {
    setPartySort((previous) => {
      if (previous === 'none') return 'ascending'
      if (previous === 'ascending') return 'descending'
      return 'none'
    })
    setNameSort('none')
  }, [])

  const sortedHouseholds = useMemo(() => {
    if (nameSort !== 'none') {
      const direction = nameSort === 'ascending' ? 1 : -1
      return [...filteredHouseholds].sort((a, b) => {
        const first = (a.guests[0]?.firstName ?? '').localeCompare(b.guests[0]?.firstName ?? '')
        return first * direction
      })
    }

    if (partySort !== 'none') {
      const direction = partySort === 'ascending' ? 1 : -1
      return [...filteredHouseholds].sort((a, b) => {
        const sizeA = partySize(a)
        const sizeB = partySize(b)
        if (sizeA == null && sizeB == null) return 0
        if (sizeA == null) return 1
        if (sizeB == null) return -1
        return (sizeA - sizeB) * direction
      })
    }

    return filteredHouseholds
  }, [filteredHouseholds, nameSort, partySort])

  const householdNumberMap = useMemo(() => {
    const map = new Map<string, number>()
    allHouseholds.forEach((household, index) => {
      map.set(household.id, index + 1)
    })
    return map
  }, [allHouseholds])

  const selectedHousehold = useMemo(
    () => filteredHouseholds.find((household) => household.id === selectedHouseholdId),
    [filteredHouseholds, selectedHouseholdId]
  )

  const selectedCanonicalHousehold = useMemo(
    () => allHouseholds.find((household) => household.id === selectedHouseholdId),
    [allHouseholds, selectedHouseholdId]
  )

  useEffect(() => {
    if (!isDrawerOpen) return
    if (!selectedHouseholdId) return
    if (selectedHousehold && selectedCanonicalHousehold) return
    setIsDrawerOpen(false)
    setSelectedHouseholdId(undefined)
    setEditingSections(new Set())
  }, [isDrawerOpen, selectedCanonicalHousehold, selectedHousehold, selectedHouseholdId])

  const createDrawerDraft = useCallback((household: HouseholdWithGuests): DrawerDraft => {
    const primary = household.guests.find((guest) => guest.isPrimaryContact)
    return {
      email: primary?.email ?? '',
      phone: normalizePhoneToE164(primary?.phone, 'IL') ?? '',
      address1: household.address1 ?? '',
      address2: household.address2 ?? '',
      city: household.city ?? '',
      state: household.state ?? '',
      zipCode: household.zipCode ?? '',
      country: household.country ?? '',
      notes: household.notes ?? '',
      likelihoodOfAttending: household.likelihoodOfAttending ?? null,
      side: household.side ?? '',
      groupName: household.groupName ?? '',
    }
  }, [])

  const resetDrawerDraft = useCallback(
    (household: HouseholdWithGuests) => {
      const nextDraft = createDrawerDraft(household)
      setDrawerDraft(nextDraft)
      setDrawerBaseline(nextDraft)
      setEditingSections(new Set())
    },
    [createDrawerDraft]
  )

  const isDrawerDirty = useMemo(() => {
    const keys: Array<keyof DrawerDraft> = [
      'email',
      'phone',
      'address1',
      'address2',
      'city',
      'state',
      'zipCode',
      'country',
      'notes',
      'likelihoodOfAttending',
      'side',
      'groupName',
    ]
    return keys.some((key) => drawerDraft[key] !== drawerBaseline[key])
  }, [drawerBaseline, drawerDraft])

  const router = useRouter()
  const updateHouseholdMutation = api.household.update.useMutation()
  const deleteHouseholdMutation = api.household.delete.useMutation()
  const deleteAllHouseholdsMutation = api.household.deleteAll.useMutation()

  const handleConfirmDeleteAll = useCallback(() => {
    deleteAllHouseholdsMutation.mutate(undefined, {
      onSuccess: ({ deleted }) => {
        setShowDeleteAllDialog(false)
        setDeleteAllConfirmText('')
        toast.success(`נמחקו ${deleted} משקי בית`)
        router.refresh()
      },
      onError: () => {
        toast.error('מחיקת כל האורחים נכשלה')
      },
    })
  }, [deleteAllHouseholdsMutation, router])

  const saveDrawerChanges = useCallback(() => {
    if (!selectedCanonicalHousehold) return

    const activeHouseholdId = selectedCanonicalHousehold.id
    const draftSnapshot: DrawerDraft = {
      email: drawerDraft.email,
      phone: drawerDraft.phone,
      address1: drawerDraft.address1,
      address2: drawerDraft.address2,
      city: drawerDraft.city,
      state: drawerDraft.state,
      zipCode: drawerDraft.zipCode,
      country: drawerDraft.country,
      notes: drawerDraft.notes,
      likelihoodOfAttending: drawerDraft.likelihoodOfAttending,
      side: drawerDraft.side,
      groupName: drawerDraft.groupName,
    }

    const guestParty = selectedCanonicalHousehold.guests.map((guest) => {
      const invites: FormInvites = {}
      guest.invitations.forEach((invitation) => {
        invites[invitation.eventId] = invitation.rsvp ?? 'Not Invited'
      })

      return {
        guestId: guest.id,
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.isPrimaryContact ? draftSnapshot.email || null : guest.email,
        phone: guest.isPrimaryContact
          ? (normalizePhoneToE164(draftSnapshot.phone, 'IL') ?? null)
          : (normalizePhoneToE164(guest.phone, 'IL') ?? null),
        isPrimaryContact: guest.isPrimaryContact,
        ageGroup: guest.ageGroup ?? 'ADULT',
        isTagAlong: guest.isTagAlong ?? false,
        tagIds: guest.guestTags?.map((guestTag) => guestTag.tagId) ?? [],
        invites,
      }
    })

    updateHouseholdMutation.mutate(
      {
        householdId: activeHouseholdId,
        address1: draftSnapshot.address1 || null,
        address2: draftSnapshot.address2 || null,
        city: draftSnapshot.city || null,
        state: draftSnapshot.state || null,
        zipCode: draftSnapshot.zipCode || null,
        country: draftSnapshot.country || null,
        notes: draftSnapshot.notes || null,
        likelihoodOfAttending: draftSnapshot.likelihoodOfAttending,
        side: draftSnapshot.side || null,
        groupName: draftSnapshot.groupName || null,
        guestParty,
        gifts: selectedCanonicalHousehold.gifts.map((gift) => ({
          eventId: gift.eventId,
          thankyou: gift.thankyou,
          description: gift.description ?? null,
        })),
      },
      {
        onSuccess: () => {
          setFilteredHouseholds((previous) =>
            previous.map((household) => {
              if (household.id !== activeHouseholdId) return household

              return {
                ...household,
                address1: draftSnapshot.address1 || null,
                address2: draftSnapshot.address2 || null,
                city: draftSnapshot.city || null,
                state: draftSnapshot.state || null,
                zipCode: draftSnapshot.zipCode || null,
                country: draftSnapshot.country || null,
                notes: draftSnapshot.notes || null,
                likelihoodOfAttending: draftSnapshot.likelihoodOfAttending,
                side: draftSnapshot.side || null,
                groupName: draftSnapshot.groupName || null,
                guests: household.guests.map((guest) => {
                  if (!guest.isPrimaryContact) return guest

                  return {
                    ...guest,
                    email: draftSnapshot.email || null,
                    phone: normalizePhoneToE164(draftSnapshot.phone, 'IL') ?? null,
                  }
                }),
              }
            })
          )
          if (selectedHouseholdId === activeHouseholdId) {
            setDrawerBaseline(draftSnapshot)
            setEditingSections(new Set())
          }
          toast.success('פרטי האורח נשמרו')
          void utils.dashboard.getForActiveWorkspace.invalidate()
        },
        onError: () => {
          toast.error('שמירת פרטי האורח נכשלה')
        },
      }
    )
  }, [drawerDraft, selectedCanonicalHousehold, selectedHouseholdId, updateHouseholdMutation, utils])

  const saveMembersChanges = useCallback(
    async (nextMembers: HouseholdMemberDraft[]) => {
      if (!selectedCanonicalHousehold || !selectedHousehold) return false

      const activeHouseholdId = selectedCanonicalHousehold.id
      const canonicalGuestsById = new Map(
        selectedCanonicalHousehold.guests.map((guest) => [guest.id, guest])
      )
      const editableGuestIds = new Set(selectedHousehold.guests.map((guest) => guest.id))

      const guestParty = nextMembers.map((member) => {
        const canonicalGuest =
          member.id !== undefined ? canonicalGuestsById.get(member.id) : undefined
        const invites: FormInvites = {}
        if (canonicalGuest) {
          canonicalGuest.invitations.forEach((invitation) => {
            invites[invitation.eventId] = invitation.rsvp ?? 'Not Invited'
          })
        } else {
          events.forEach((event) => {
            invites[event.id] = 'Not Invited'
          })
        }

        return {
          guestId: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          phone: normalizePhoneToE164(member.phone, 'IL') ?? member.phone ?? null,
          isPrimaryContact: member.isPrimaryContact,
          ageGroup: member.ageGroup,
          isTagAlong: member.isTagAlong,
          tagIds: member.tagIds,
          invites,
        }
      })

      const nextMemberIds = new Set(
        nextMembers
          .map((member) => member.id)
          .filter((memberId): memberId is number => memberId !== undefined)
      )
      const hiddenCanonicalGuestParty = selectedCanonicalHousehold.guests
        .filter((guest) => !editableGuestIds.has(guest.id))
        .map((guest) => {
          const invites: FormInvites = {}
          guest.invitations.forEach((invitation) => {
            invites[invitation.eventId] = invitation.rsvp ?? 'Not Invited'
          })

          return {
            guestId: guest.id,
            firstName: guest.firstName,
            lastName: guest.lastName,
            email: guest.email,
            phone: normalizePhoneToE164(guest.phone, 'IL') ?? guest.phone ?? null,
            isPrimaryContact: guest.isPrimaryContact,
            ageGroup: guest.ageGroup ?? 'ADULT',
            isTagAlong: guest.isTagAlong ?? false,
            tagIds: guest.guestTags?.map((guestTag) => guestTag.tagId) ?? [],
            invites,
          }
        })

      const deletedGuests = selectedHousehold.guests
        .filter((guest) => !nextMemberIds.has(guest.id))
        .map((guest) => guest.id)

      return await new Promise<boolean>((resolve) => {
        updateHouseholdMutation.mutate(
          {
            householdId: activeHouseholdId,
            address1: selectedCanonicalHousehold.address1,
            address2: selectedCanonicalHousehold.address2,
            city: selectedCanonicalHousehold.city,
            state: selectedCanonicalHousehold.state,
            zipCode: selectedCanonicalHousehold.zipCode,
            country: selectedCanonicalHousehold.country,
            notes: selectedCanonicalHousehold.notes,
            guestParty: [...guestParty, ...hiddenCanonicalGuestParty],
            deletedGuests: deletedGuests.length > 0 ? deletedGuests : undefined,
            gifts: selectedCanonicalHousehold.gifts.map((gift) => ({
              eventId: gift.eventId,
              thankyou: gift.thankyou,
              description: gift.description ?? null,
            })),
          },
          {
            onSuccess: () => {
              setFilteredHouseholds((previous) =>
                previous.map((household) => {
                  if (household.id !== activeHouseholdId) return household

                  const displayedGuestsById = new Map(
                    household.guests.map((guest) => [guest.id, guest])
                  )

                  return {
                    ...household,
                    guests: nextMembers.map((member, index) => {
                      const guestId = member.id ?? -(index + 1)
                      const sourceGuest =
                        (member.id !== undefined
                          ? canonicalGuestsById.get(member.id)
                          : undefined) ??
                        (member.id !== undefined ? displayedGuestsById.get(member.id) : undefined)

                      return {
                        ...(sourceGuest ?? {
                          id: guestId,
                          householdId: household.id,
                          weddingId: household.weddingId,
                          isTagAlong: false,
                          createdAt: household.createdAt,
                          updatedAt: household.updatedAt,
                          guestTags: [],
                          invitations: [],
                        }),
                        id: guestId,
                        firstName: member.firstName,
                        lastName: member.lastName,
                        email: member.email,
                        phone: member.phone,
                        ageGroup: member.ageGroup,
                        isPrimaryContact: member.isPrimaryContact,
                        isTagAlong: member.isTagAlong,
                        guestTags: member.tagIds.map((tagId) => ({ tagId })),
                      }
                    }),
                  }
                })
              )
              toast.success('בני הבית נשמרו')
              void utils.dashboard.getForActiveWorkspace.invalidate()
              resolve(true)
            },
            onError: () => {
              toast.error('שמירת בני הבית נכשלה')
              resolve(false)
            },
          }
        )
      })
    },
    [events, selectedCanonicalHousehold, selectedHousehold, updateHouseholdMutation, utils]
  )

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId),
    [events, selectedEventId]
  )

  const selectedEventResponses = useMemo(() => {
    return selectedHousehold?.guests.map((guest) => {
      const invitation = guest.invitations.find((inv) => inv.eventId === selectedEventId)
      return {
        id: guest.id,
        name: `${guest.firstName} ${guest.lastName}`,
        rsvp: invitation?.rsvp ?? 'Not Invited',
      }
    })
  }, [selectedEventId, selectedHousehold])
  const selectedHouseholdTags = useMemo(() => {
    if (!selectedHousehold) return []

    const uniqueTagIds = Array.from(
      new Set(
        selectedHousehold.guests
          .flatMap((guest) => guest.guestTags ?? [])
          .map((guestTag) => guestTag.tagId)
          .filter(Boolean)
      )
    ).slice(0, 4)

    return uniqueTagIds
      .map((tagId) => allTags.find((t) => t.id === tagId))
      .filter((t): t is NonNullable<typeof t> => t !== undefined)
  }, [selectedHousehold, allTags])

  useEffect(() => {
    if (!isDrawerOpen || !selectedHousehold) return
    if (initializedDrawerHouseholdIdRef.current === selectedHousehold.id) return
    resetDrawerDraft(selectedHousehold)
    initializedDrawerHouseholdIdRef.current = selectedHousehold.id
  }, [isDrawerOpen, resetDrawerDraft, selectedHousehold])

  const handleDiscardChanges = useCallback(() => {
    setDrawerDraft(drawerBaseline)
    setEditingSections(new Set())
  }, [drawerBaseline])

  const handleConfirmDeleteHousehold = useCallback(() => {
    if (!selectedCanonicalHousehold) return
    const householdId = selectedCanonicalHousehold.id
    deleteHouseholdMutation.mutate(
      { householdId },
      {
        onSuccess: () => {
          setShowDeleteHouseholdDialog(false)
          setIsDrawerOpen(false)
          setSelectedHouseholdId(undefined)
          initializedDrawerHouseholdIdRef.current = undefined
          setEditingSections(new Set())
          setFilteredHouseholds((previous) =>
            previous.filter((household) => household.id !== householdId)
          )
          toast.success('המסיבה נמחקה בהצלחה')
          void utils.dashboard.getForActiveWorkspace.invalidate()
        },
        onError: () => {
          toast.error('מחיקת המסיבה נכשלה')
        },
      }
    )
  }, [deleteHouseholdMutation, selectedCanonicalHousehold, utils])

  const { data: communicationLog = [] } = api.communicationLog.getByHouseholdId.useQuery(
    { householdId: selectedHousehold?.id ?? '' },
    { enabled: !!selectedHousehold }
  )

  const { data: householdAnswers = [], isLoading: isLoadingAnswers } =
    api.question.getAnswersByHousehold.useQuery(
      { householdId: selectedHousehold?.id ?? '' },
      { enabled: !!selectedHousehold }
    )

  const addNoteMutation = api.communicationLog.addNote.useMutation({
    onSuccess: (_data, variables) => {
      toast.success('ההערה נוספה')
      void utils.communicationLog.getByHouseholdId.invalidate({
        householdId: variables.householdId,
      })
    },
    onError: () => {
      toast.error('הוספת ההערה נכשלה')
    },
  })

  const deleteNoteMutation = api.communicationLog.deleteNote.useMutation({
    onSuccess: () => {
      toast.success('ההערה הוסרה')
      if (selectedHousehold) {
        void utils.communicationLog.getByHouseholdId.invalidate({
          householdId: selectedHousehold.id,
        })
      }
    },
    onError: () => {
      toast.error('מחיקת ההערה נכשלה')
    },
  })

  const handleSelectHousehold = useCallback((household: HouseholdWithGuests) => {
    setSelectedHouseholdId(household.id)
    setEditingSections(new Set())
    setIsDrawerOpen(true)
  }, [])

  const toggleEditingSection = useCallback((section: 'contactAddress' | 'notes' | 'sideGroup') => {
    setEditingSections((previous) => {
      const next = new Set(previous)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }, [])

  const rsvpManageHref = useMemo(() => {
    if (selectedEventId === 'all') return '/events?tab=rsvps'
    return `/events?eventId=${selectedEventId}&tab=rsvps`
  }, [selectedEventId])

  const sortStateLabel = useMemo(() => {
    if (nameSort === 'ascending') return 'שם (א-ת)'
    if (nameSort === 'descending') return 'שם (ת-א)'
    if (partySort === 'ascending') return 'גודל קבוצה (מהקטן לגדול)'
    if (partySort === 'descending') return 'גודל קבוצה (מהגדול לקטן)'
    return undefined
  }, [nameSort, partySort])

  const activeSort = useMemo(() => {
    if (nameSort !== 'none') return { field: 'name' as const, direction: nameSort }
    if (partySort !== 'none') return { field: 'partySize' as const, direction: partySort }
    return undefined
  }, [nameSort, partySort])

  const handleDrawerOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isDrawerDirty) {
        setShowDiscardDialog(true)
        return
      }

      setIsDrawerOpen(open)
      if (open) return
      setSelectedHouseholdId(undefined)
      initializedDrawerHouseholdIdRef.current = undefined
      setEditingSections(new Set())
    },
    [isDrawerDirty]
  )

  return (
    <section>
      {selectedEventId === 'all' ? (
        <DefaultTableHeader
          households={filteredHouseholds}
          totalGuests={totalGuests}
          totalTagAlongs={totalTagAlongs}
          numEvents={events.length}
        />
      ) : (
        <SelectedEventTableHeader
          totalGuests={totalGuests}
          households={filteredHouseholds}
          selectedEvent={selectedEvent}
          setPrefillEvent={setPrefillEvent}
        />
      )}
      <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <GuestSearchFilter
          setFilteredHouseholds={setFilteredHouseholds}
          households={households}
          events={events}
          selectedEventId={selectedEventId}
        />
        <div className='flex shrink-0 gap-3'>
          {workspace.capabilities.canDeleteAllGuests && (
            <Button
              type='button'
              variant='outline'
              className='border-destructive text-destructive hover:bg-destructive/10'
              onClick={() => setShowDeleteAllDialog(true)}
            >
              מחיקת כל האורחים
            </Button>
          )}
          <Button type='button' variant='outline' onClick={onImportClick}>
            ייבוא אורחים
          </Button>
          <Button
            type='button'
            onClick={() => {
              setPrefillHousehold(undefined)
              toggleGuestForm()
            }}
          >
            הוספת אורח
          </Button>
        </div>
      </div>
      <div className='space-y-4'>
        <ListToolbar
          totalHouseholds={sortedHouseholds.length}
          totalUnfilteredHouseholds={households.length}
          totalGuests={totalGuests}
          totalUnfilteredGuests={totalUnfilteredGuests}
          onSortByName={sortByName}
          onSortByPartySize={sortByParty}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          workflowMode={workflowMode}
          onWorkflowModeChange={setWorkflowMode}
          sortStateLabel={sortStateLabel}
          activeSort={activeSort}
        />
        {sortedHouseholds.length === 0 ? (
          <AsyncState isEmpty emptyText='אין משקי בית עדיין' />
        ) : workflowMode === 'personAudit' || viewMode === 'table' ? (
          <GuestIndividualTable
            households={sortedHouseholds}
            householdNumberMap={householdNumberMap}
            selectedHouseholdId={selectedHouseholdId}
            onSelectHousehold={handleSelectHousehold}
          />
        ) : (
          <GuestCardsList
            households={sortedHouseholds}
            selectedHouseholdId={selectedHouseholdId}
            onSelectHousehold={handleSelectHousehold}
          />
        )}
      </div>

      <GuestDetailDrawer
        open={isDrawerOpen && selectedHousehold !== undefined}
        onOpenChange={handleDrawerOpenChange}
        title={
          selectedHousehold?.guests[0]
            ? `${selectedHousehold.guests[0].firstName} ${selectedHousehold.guests[0].lastName}`
            : 'פרטי אורח'
        }
        subtitle={selectedEventId === 'all' ? 'בכל האירועים' : selectedEvent?.name}
        headerMeta={
          <div className='flex flex-wrap gap-1.5'>
            {isDrawerDirty ? (
              <Badge
                variant='outline'
                className='border-amber-500/40 bg-amber-500/10 text-[0.58rem] text-amber-700 uppercase tracking-wider'
              >
                שינויים שלא נשמרו
              </Badge>
            ) : null}
            {selectedHouseholdTags.map((tag) => (
              <Badge
                key={tag.id}
                variant='outline'
                className='border-foreground/15 bg-foreground/[0.04] text-[0.58rem] text-foreground/70 uppercase tracking-wider'
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        }
        footer={
          isDrawerDirty ? (
            <div className='flex gap-2'>
              <Button
                type='button'
                variant='outline'
                className='flex-1'
                onClick={handleDiscardChanges}
              >
                ביטול שינויים
              </Button>
              <Button
                type='button'
                className='flex-1'
                onClick={saveDrawerChanges}
                disabled={updateHouseholdMutation.isPending}
              >
                שמירת שינויים
              </Button>
            </div>
          ) : null
        }
      >
        {selectedHousehold ? (
          <GuestDetailPanelContent
            selectedHousehold={selectedHousehold}
            selectedEventId={selectedEventId}
            events={events}
            selectedEventResponses={selectedEventResponses}
            communicationLog={communicationLog}
            householdAnswers={householdAnswers}
            isLoadingAnswers={isLoadingAnswers}
            editingSections={editingSections}
            toggleEditingSection={toggleEditingSection}
            drawerDraft={drawerDraft}
            setDrawerDraft={setDrawerDraft}
            rsvpManageHref={rsvpManageHref}
            onSaveMembers={saveMembersChanges}
            onAddNote={(message) => {
              if (selectedHousehold) {
                addNoteMutation.mutate({ householdId: selectedHousehold.id, message })
              }
            }}
            onDeleteNote={(noteId) => {
              deleteNoteMutation.mutate({ noteId })
            }}
            onRequestDelete={() => setShowDeleteHouseholdDialog(true)}
          />
        ) : null}
      </GuestDetailDrawer>
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>לבטל שינויים שלא נשמרו?</AlertDialogTitle>
            <AlertDialogDescription>
              יש שינויים שלא נשמרו במגירה. המשיכו לערוך כדי להמשיך, או בטלו וסגרו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>המשך עריכה</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDiscardDialog(false)
                setIsDrawerOpen(false)
                setSelectedHouseholdId(undefined)
                initializedDrawerHouseholdIdRef.current = undefined
                setEditingSections(new Set())
              }}
            >
              ביטול וסגירה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteHouseholdDialog} onOpenChange={setShowDeleteHouseholdDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(() => {
                const primary =
                  selectedCanonicalHousehold?.guests.find((g) => g.isPrimaryContact) ??
                  selectedCanonicalHousehold?.guests[0]
                const name = primary
                  ? `${primary.firstName} ${primary.lastName}`.trim()
                  : 'קבוצה זו'
                return `למחוק את ״${name}״?`
              })()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק לצמיתות את הקבוצה ואת כל האורחים המשויכים אליה. לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteHouseholdMutation.isPending}>
              ביטול
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDeleteHousehold()
              }}
              disabled={deleteHouseholdMutation.isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteHouseholdMutation.isPending ? 'מוחק...' : 'מחיקת מפלגה'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showDeleteAllDialog}
        onOpenChange={(open) => {
          setShowDeleteAllDialog(open)
          if (!open) setDeleteAllConfirmText('')
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת כל האורחים?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק לצמיתות את כל משקי הבית, האורחים, ההזמנות, אישורי ההגעה, ההושבה והמתנות
              של החתונה הנוכחית. לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='delete-all-confirm'>
              הקלידו <span className='font-semibold'>מחק הכל</span> לאישור
            </Label>
            <Input
              id='delete-all-confirm'
              value={deleteAllConfirmText}
              onChange={(e) => setDeleteAllConfirmText(e.target.value)}
              autoComplete='off'
              disabled={deleteAllHouseholdsMutation.isPending}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAllHouseholdsMutation.isPending}>
              ביטול
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDeleteAll()
              }}
              disabled={deleteAllConfirmText !== 'מחק הכל' || deleteAllHouseholdsMutation.isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteAllHouseholdsMutation.isPending ? 'מוחק...' : 'מחיקת כל האורחים'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

type DefaultTableHeaderProps = {
  households: HouseholdWithGuests[]
  numEvents: number
  totalGuests: number
  totalTagAlongs: number
}

const DefaultTableHeader = ({
  households,
  numEvents,
  totalGuests,
  totalTagAlongs,
}: DefaultTableHeaderProps) => {
  return (
    <div className='py-8'>
      <div className='flex flex-wrap items-center gap-4 md:gap-6'>
        <div>
          <span className='font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'>
            סה״כ משקי בית:{' '}
          </span>
          <span className='font-semibold text-foreground text-sm md:text-base'>
            {households.length}
          </span>
        </div>
        <div className='hidden h-4 w-px bg-border md:block' />
        <div>
          <span className='font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'>
            סה״כ אורחים:{' '}
          </span>
          <span className='font-semibold text-foreground text-sm md:text-base'>
            {totalGuests}
            {totalTagAlongs > 0 && (
              <span className='font-normal text-foreground/55'>
                {' '}
                + {totalTagAlongs} {totalTagAlongs !== 1 ? 'נלווים' : 'נלווה'}
              </span>
            )}
          </span>
        </div>
        <div className='hidden h-4 w-px bg-border md:block' />
        <div>
          <span className='font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'>
            סה״כ אירועים:{' '}
          </span>
          <span className='font-semibold text-foreground text-sm md:text-base'>{numEvents}</span>
        </div>
      </div>
    </div>
  )
}

type SelectedEventTableHeaderProps = {
  totalGuests: number
  households: HouseholdWithGuests[]
  selectedEvent: Event | undefined
  setPrefillEvent: Dispatch<SetStateAction<EventFormData | undefined>>
}

const SelectedEventTableHeader = ({
  totalGuests,
  households,
  selectedEvent,
  setPrefillEvent,
}: SelectedEventTableHeaderProps) => {
  const toggleEventForm = useToggleEventForm()
  const guestResponses = useMemo(() => {
    const guestResponses = {
      attending: 0,
      declined: 0,
      noResponse: 0,
    }

    households.forEach((household) => {
      household.guests.forEach((guest) => {
        if (!guest.invitations) return
        const matchingInvitation = guest.invitations.find(
          (inv) => inv.eventId === selectedEvent?.id
        )
        if (!matchingInvitation) return
        switch (matchingInvitation.rsvp) {
          case 'Attending':
            guestResponses.attending += 1
            break
          case 'Declined':
            guestResponses.declined += 1
            break
          default:
            guestResponses.noResponse += 1
            break
        }
      })
    })

    return guestResponses
  }, [households, selectedEvent])

  if (selectedEvent === undefined) return null

  const handleEditEvent = (event: Event) => {
    const standardDate = formatDateStandard(event.date)

    setPrefillEvent({
      eventName: event.name,
      date: standardDate ?? undefined,
      startTime: event.startTime ?? undefined,
      endTime: event.endTime ?? undefined,
      venue: event.venue ?? undefined,
      attire: event.attire ?? undefined,
      description: event.description ?? undefined,
      eventId: event.id,
      allowTagAlongs: event.allowTagAlongs ?? false,
    })
    toggleEventForm()
  }

  return (
    <div className='py-8'>
      <div className='mb-4 flex items-center gap-2'>
        <h2 className='font-bold text-xl'>{selectedEvent.name}</h2>
        <button
          type='button'
          aria-label='עריכת פרטי האירוע'
          className='rounded-sm text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 focus-visible:ring-offset-2'
          onClick={() => handleEditEvent(selectedEvent)}
        >
          <BiPencil size={22} aria-hidden='true' />
        </button>
      </div>
      <div className='flex flex-wrap items-center gap-4 md:gap-6'>
        <span className='font-semibold text-foreground'>{totalGuests} אורחים הוזמנו:</span>
        <div className='flex items-center gap-1.5'>
          <span className='h-1.5 w-1.5 rounded-full bg-success' />
          <span className='font-medium'>{guestResponses.attending}</span>
          <span className='font-mono text-[0.58rem] text-foreground/60 uppercase tracking-wider'>
            מגיעים
          </span>
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='h-1.5 w-1.5 rounded-full bg-destructive' />
          <span className='font-medium'>{guestResponses.declined}</span>
          <span className='font-mono text-[0.58rem] text-foreground/60 uppercase tracking-wider'>
            לא מגיעים
          </span>
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='h-1.5 w-1.5 rounded-full bg-muted-foreground' />
          <span className='font-medium'>{guestResponses.noResponse}</span>
          <span className='font-mono text-[0.58rem] text-foreground/60 uppercase tracking-wider'>
            אין תגובה
          </span>
        </div>
      </div>
    </div>
  )
}
