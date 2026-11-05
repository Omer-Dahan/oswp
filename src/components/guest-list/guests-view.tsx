import { useRouter } from 'next/navigation'
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
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
import { GuestListLoadingIndicator } from '~/components/guest-list/guest-list-loading-indicator'
import {
  clearGuestListViewState,
  DEFAULT_GUEST_LIST_VIEW_STATE,
  type GuestListFilters,
  readGuestListViewState,
  writeGuestListViewState,
} from '~/components/guest-list/guest-list-view-state'
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
import { deriveGuestListCounts } from '~/lib/guest-list-counts'
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
  const weddingId = allHouseholds[0]?.weddingId ?? workspace.weddingId
  const [initialViewState] = useState(() => readGuestListViewState(weddingId))
  const { data: allTags = [] } = api.guestTag.getAll.useQuery()
  const toggleGuestForm = useToggleGuestForm()
  // The source GuestSearchFilter rebuilds from. Kept in sync with the `households`
  // prop, but also patched optimistically on save so a filter/search action run
  // before the server refresh lands doesn't rebuild from stale, pre-save data.
  const [baseHouseholds, setBaseHouseholds] = useState(households)
  const [filteredHouseholds, setFilteredHouseholds] = useState(households)
  const [nameSort, setNameSort] = useState(initialViewState.nameSort)
  const [partySort, setPartySort] = useState(initialViewState.partySort)
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | undefined>()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewState.viewMode)
  const [filters, setFilters] = useState<GuestListFilters>(initialViewState.filters)
  const [filterResetKey, setFilterResetKey] = useState(0)
  const [isRefreshing, startRefreshTransition] = useTransition()
  const skipNextPersistenceRef = useRef(false)
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

  useEffect(() => {
    if (skipNextPersistenceRef.current) {
      skipNextPersistenceRef.current = false
      return
    }
    writeGuestListViewState(weddingId, { viewMode, nameSort, partySort, filters })
  }, [filters, nameSort, partySort, viewMode, weddingId])

  const resetView = useCallback(() => {
    skipNextPersistenceRef.current = true
    clearGuestListViewState(weddingId)
    setViewMode(DEFAULT_GUEST_LIST_VIEW_STATE.viewMode)
    setNameSort(DEFAULT_GUEST_LIST_VIEW_STATE.nameSort)
    setPartySort(DEFAULT_GUEST_LIST_VIEW_STATE.partySort)
    setFilters(DEFAULT_GUEST_LIST_VIEW_STATE.filters)
    setFilterResetKey((key) => key + 1)
  }, [weddingId])

  const { filteredCounts, totalTagAlongs } = useMemo(() => {
    let tagAlongs = 0
    for (const household of filteredHouseholds ?? []) {
      for (const guest of household.guests) {
        if (guest.isTagAlong) tagAlongs += 1
      }
    }
    return {
      filteredCounts: deriveGuestListCounts(
        filteredHouseholds,
        selectedEventId === 'all' ? undefined : selectedEventId
      ),
      totalTagAlongs: tagAlongs,
    }
  }, [filteredHouseholds, selectedEventId])

  const unfilteredCounts = useMemo(() => deriveGuestListCounts(baseHouseholds), [baseHouseholds])

  useEffect(() => {
    setBaseHouseholds(households)
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
        startRefreshTransition(() => router.refresh())
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

    // This panel owns only household-level fields plus the primary contact's
    // email/phone - it must not touch names, tags, isTagAlong or isPrimaryContact
    // (the members panel owns those), so the guestParty it sends contains only
    // the primary contact, with only the fields this panel actually edits. Every
    // other guest, and every field not listed here, is left untouched by the
    // service rather than rewritten from this stale canonical snapshot.
    const primaryContact =
      selectedCanonicalHousehold.guests.find((guest) => guest.isPrimaryContact) ??
      selectedCanonicalHousehold.guests[0]
    const invites: FormInvites = {}
    const guestParty = primaryContact
      ? [
          {
            guestId: primaryContact.id,
            email: draftSnapshot.email || null,
            phone: normalizePhoneToE164(draftSnapshot.phone, 'IL') ?? null,
            invites,
          },
        ]
      : []

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
          const applyPatch = (previous: HouseholdWithGuests[]) =>
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
          setFilteredHouseholds(applyPatch)
          setBaseHouseholds(applyPatch)
          if (selectedHouseholdId === activeHouseholdId) {
            setDrawerBaseline(draftSnapshot)
            setEditingSections(new Set())
          }
          toast.success('פרטי האורח נשמרו')
          void utils.dashboard.getForActiveWorkspace.invalidate()
          startRefreshTransition(() => router.refresh())
        },
        onError: () => {
          toast.error('שמירת פרטי האורח נכשלה')
        },
      }
    )
  }, [
    drawerDraft,
    router,
    selectedCanonicalHousehold,
    selectedHouseholdId,
    updateHouseholdMutation,
    utils,
  ])

  const saveMembersChanges = useCallback(
    async (nextMembers: HouseholdMemberDraft[]) => {
      if (!selectedCanonicalHousehold || !selectedHousehold) return false

      const activeHouseholdId = selectedCanonicalHousehold.id
      const canonicalGuestsById = new Map(
        selectedCanonicalHousehold.guests.map((guest) => [guest.id, guest])
      )
      const editableGuestIds = new Set(selectedHousehold.guests.map((guest) => guest.id))

      // This panel owns names/ageGroup/tags/isTagAlong/isPrimaryContact and
      // who exists, never household fields or a guest's email/phone - so the
      // household-level fields below are omitted entirely (left untouched)
      // and email/phone are never part of the guestParty it sends, even
      // though the local draft still carries them for display.
      const guestParty = nextMembers.map((member) => {
        const canonicalGuest =
          member.id !== undefined ? canonicalGuestsById.get(member.id) : undefined
        // An existing member (has a canonical guest) keeps an empty `invites`
        // so this edit to names/tags/age-group never rewrites their RSVPs.
        // Only a brand-new member needs the default "Not Invited" rows.
        const invites: FormInvites = {}
        if (!canonicalGuest) {
          events.forEach((event) => {
            invites[event.id] = 'Not Invited'
          })
        }

        return {
          guestId: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
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
      // Guests hidden from the current filtered view are still sent back
      // with their existing isPrimaryContact/tags/etc preserved, since this
      // save clears every guest's primary-contact flag before re-setting it
      // from guestParty (see household-management.service.ts) - a guest
      // missing from the request entirely would lose that flag instead of
      // keeping it.
      const hiddenCanonicalGuestParty = selectedCanonicalHousehold.guests
        .filter((guest) => !editableGuestIds.has(guest.id))
        .map((guest) => {
          const invites: FormInvites = {}

          return {
            guestId: guest.id,
            firstName: guest.firstName,
            lastName: guest.lastName,
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
            guestParty: [...guestParty, ...hiddenCanonicalGuestParty],
            deletedGuests: deletedGuests.length > 0 ? deletedGuests : undefined,
            gifts: selectedCanonicalHousehold.gifts.map((gift) => ({
              eventId: gift.eventId,
              thankyou: gift.thankyou,
              description: gift.description ?? null,
            })),
          },
          {
            onSuccess: (result) => {
              const applyPatch = (previous: HouseholdWithGuests[]) =>
                previous.map((household) => {
                  if (household.id !== activeHouseholdId) return household

                  const displayedGuestsById = new Map(
                    household.guests.map((guest) => [guest.id, guest])
                  )

                  return {
                    ...household,
                    guests: nextMembers.map((member, index) => {
                      const sourceGuest =
                        (member.id !== undefined
                          ? canonicalGuestsById.get(member.id)
                          : undefined) ??
                        (member.id !== undefined ? displayedGuestsById.get(member.id) : undefined)
                      // The server response's guests are in the same order as
                      // the guestParty this save sent (visible members first,
                      // same indices as nextMembers), which gives a brand-new
                      // member its real DB id instead of a fabricated one that
                      // the next save would send back as an invalid guestId.
                      const guestId = result.guests[index]?.id ?? sourceGuest?.id ?? member.id ?? 0

                      return {
                        ...(sourceGuest ?? {
                          id: guestId,
                          householdId: household.id,
                          weddingId: household.weddingId,
                          email: null,
                          phone: null,
                          isTagAlong: false,
                          createdAt: household.createdAt,
                          updatedAt: household.updatedAt,
                          guestTags: [],
                          invitations: [],
                        }),
                        id: guestId,
                        firstName: member.firstName,
                        lastName: member.lastName,
                        ageGroup: member.ageGroup,
                        isPrimaryContact: member.isPrimaryContact,
                        isTagAlong: member.isTagAlong,
                        guestTags: member.tagIds.map((tagId) => ({ tagId })),
                      }
                    }),
                  }
                })
              setFilteredHouseholds(applyPatch)
              setBaseHouseholds(applyPatch)
              toast.success('בני הבית נשמרו')
              void utils.dashboard.getForActiveWorkspace.invalidate()
              startRefreshTransition(() => router.refresh())
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
    [events, router, selectedCanonicalHousehold, selectedHousehold, updateHouseholdMutation, utils]
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
          toast.success('המשפחה נמחקה בהצלחה')
          void utils.dashboard.getForActiveWorkspace.invalidate()
        },
        onError: () => {
          toast.error('מחיקת המשפחה נכשלה')
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
          counts={filteredCounts}
          totalTagAlongs={totalTagAlongs}
        />
      ) : (
        <SelectedEventTableHeader
          counts={filteredCounts}
          selectedEvent={selectedEvent}
          setPrefillEvent={setPrefillEvent}
        />
      )}
      <div className='relative mb-4 flex flex-col gap-3'>
        <GuestSearchFilter
          setFilteredHouseholds={setFilteredHouseholds}
          households={baseHouseholds}
          events={events}
          selectedEventId={selectedEventId}
          initialFilters={filters}
          resetKey={filterResetKey}
          onFiltersChange={setFilters}
        />
        <div className='flex shrink-0 gap-3 md:absolute md:end-0 md:top-0'>
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
          totalUnfilteredHouseholds={baseHouseholds.length}
          totalGuests={filteredCounts.guests}
          totalUnfilteredGuests={unfilteredCounts.guests}
          onSortByName={sortByName}
          onSortByPartySize={sortByParty}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          workflowMode={workflowMode}
          onWorkflowModeChange={setWorkflowMode}
          sortStateLabel={sortStateLabel}
          activeSort={activeSort}
          onResetView={resetView}
        />
        {sortedHouseholds.length === 0 ? (
          <AsyncState isEmpty emptyText='אין משקי בית עדיין' />
        ) : workflowMode === 'personAudit' || viewMode === 'table' ? (
          <GuestIndividualTable
            households={sortedHouseholds}
            householdNumberMap={householdNumberMap}
            selectedHouseholdId={selectedHouseholdId}
            onSelectHousehold={handleSelectHousehold}
            events={events}
          />
        ) : (
          <GuestCardsList
            households={sortedHouseholds}
            selectedHouseholdId={selectedHouseholdId}
            onSelectHousehold={handleSelectHousehold}
            events={events}
          />
        )}
      </div>

      <GuestListLoadingIndicator loading={isRefreshing} refetching />

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
            allHouseholds={allHouseholds}
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
              {deleteHouseholdMutation.isPending ? 'מוחק...' : 'מחיקת משפחה'}
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
  counts: ReturnType<typeof deriveGuestListCounts>
  totalTagAlongs: number
}

const DefaultTableHeader = ({ households, counts, totalTagAlongs }: DefaultTableHeaderProps) => {
  return (
    <div className='py-8'>
      <div className='flex flex-wrap items-center gap-4 md:gap-6'>
        <div className='whitespace-nowrap'>
          <span className='font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'>
            סה״כ משקי בית:{' '}
          </span>
          <span className='font-semibold text-foreground text-sm md:text-base'>
            {households.length}
          </span>
        </div>
        <div className='hidden h-4 w-px bg-border md:block' />
        <div className='whitespace-nowrap'>
          <span className='font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'>
            סה״כ אורחים:{' '}
          </span>
          <span className='font-semibold text-foreground text-sm md:text-base'>
            {counts.guests}
            {totalTagAlongs > 0 && (
              <span className='font-normal text-foreground/55'>
                {' '}
                + {totalTagAlongs} {totalTagAlongs !== 1 ? 'נלווים' : 'נלווה'}
              </span>
            )}
          </span>
        </div>
        <div className='whitespace-nowrap'>
          <span className='font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'>
            מגיעים:{' '}
          </span>
          <span className='font-semibold text-sm text-success md:text-base'>
            {counts.attending}
          </span>
        </div>
        <div className='whitespace-nowrap'>
          <span className='font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'>
            לא מגיעים:{' '}
          </span>
          <span className='font-semibold text-destructive text-sm md:text-base'>
            {counts.declined}
          </span>
        </div>
        <div className='whitespace-nowrap'>
          <span className='font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'>
            טרם השיבו:{' '}
          </span>
          <span className='font-semibold text-muted-foreground text-sm md:text-base'>
            {counts.noResponse}
          </span>
        </div>
      </div>
    </div>
  )
}

type SelectedEventTableHeaderProps = {
  counts: ReturnType<typeof deriveGuestListCounts>
  selectedEvent: Event | undefined
  setPrefillEvent: Dispatch<SetStateAction<EventFormData | undefined>>
}

const SelectedEventTableHeader = ({
  counts,
  selectedEvent,
  setPrefillEvent,
}: SelectedEventTableHeaderProps) => {
  const toggleEventForm = useToggleEventForm()
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
        <span className='font-semibold text-foreground'>{counts.guests} אורחים הוזמנו:</span>
        <div className='flex items-center gap-1.5'>
          <span className='h-1.5 w-1.5 rounded-full bg-success' />
          <span className='font-medium'>{counts.attending}</span>
          <span className='font-mono text-[0.58rem] text-foreground/60 uppercase tracking-wider'>
            אורחים מגיעים
          </span>
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='h-1.5 w-1.5 rounded-full bg-destructive' />
          <span className='font-medium'>{counts.declined}</span>
          <span className='font-mono text-[0.58rem] text-foreground/60 uppercase tracking-wider'>
            אורחים לא מגיעים
          </span>
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='h-1.5 w-1.5 rounded-full bg-muted-foreground' />
          <span className='font-medium'>{counts.noResponse}</span>
          <span className='font-mono text-[0.58rem] text-foreground/60 uppercase tracking-wider'>
            אורחים ללא מענה
          </span>
        </div>
      </div>
    </div>
  )
}
