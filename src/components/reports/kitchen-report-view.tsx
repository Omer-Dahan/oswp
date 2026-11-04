'use client'

import { Download, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { AsyncState } from '~/components/ui/async-state'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { api } from '~/trpc/react'

type ReportEvent = { id: string; name: string }

type KitchenReportViewProps = {
  events: ReportEvent[]
  initialEventId: string | null
}

export function KitchenReportView(props: Readonly<KitchenReportViewProps>) {
  const { events, initialEventId } = props
  const [eventId, setEventId] = useState(initialEventId ?? events[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [onlyKidsMenu, setOnlyKidsMenu] = useState(false)
  const [onlyDietary, setOnlyDietary] = useState(false)

  const reportQuery = api.report.getKitchenReport.useQuery(
    { eventId: eventId ?? '' },
    { enabled: eventId !== null }
  )

  const utils = api.useUtils()
  const plansQuery = api.report.getGroupPortionPlans.useQuery()
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null)
  const [editHeadcount, setEditHeadcount] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [newHeadcount, setNewHeadcount] = useState('')

  const invalidatePlans = () => {
    void utils.report.getGroupPortionPlans.invalidate()
    void utils.report.getKitchenReport.invalidate()
  }

  const setPlanMutation = api.report.setGroupPortionPlan.useMutation({
    onSuccess: () => {
      invalidatePlans()
      setEditingGroupName(null)
      setNewGroupName('')
      setNewHeadcount('')
    },
  })
  const deletePlanMutation = api.report.deleteGroupPortionPlan.useMutation({
    onSuccess: invalidatePlans,
  })

  const actualMealsByGroup = useMemo(() => {
    const map = new Map<string, { actualMeals: number; usedMeals: number }>()
    for (const group of reportQuery.data?.groups ?? []) {
      map.set(group.groupName, { actualMeals: group.actualMeals, usedMeals: group.usedMeals })
    }
    return map
  }, [reportQuery.data])

  const plans = plansQuery.data?.plans ?? []
  const unplannedGroupNames = (plansQuery.data?.availableGroupNames ?? []).filter(
    (name) => !plans.some((plan) => plan.groupName === name)
  )

  const rows = useMemo(() => {
    const allRows = reportQuery.data?.rows ?? []
    const term = search.trim().toLowerCase()
    return allRows.filter((row) => {
      if (onlyKidsMenu && !row.isChild) return false
      if (onlyDietary && row.dietaryNote === null) return false
      if (term) {
        const haystack = `${row.guestName} ${row.householdName}`.toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [reportQuery.data, search, onlyKidsMenu, onlyDietary])

  const hasSeating = (reportQuery.data?.rows ?? []).some((row) => row.tableName !== null)

  if (events.length === 0) {
    return <AsyncState isEmpty emptyText='צרו קודם אירוע כדי להציג דף מטבח.' />
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <Select
          value={eventId ?? undefined}
          onValueChange={(value) => setEventId(value)}
        >
          <SelectTrigger className='sm:w-64' aria-label='אירוע'>
            <SelectValue placeholder='בחירת אירוע' />
          </SelectTrigger>
          <SelectContent>
            {events.map((event) => (
              <SelectItem key={event.id} value={event.id}>
                {event.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button asChild variant='outline' disabled={!eventId}>
          <a href={eventId ? `/api/reports/kitchen?eventId=${eventId}` : undefined}>
            <Download className='me-2 h-4 w-4' aria-hidden='true' />
            הורדת אקסל
          </a>
        </Button>
      </div>

      {reportQuery.isLoading && <AsyncState isLoading loadingText='טוען נתונים...' />}
      {reportQuery.error && <AsyncState error='אירעה שגיאה בטעינת הדוח' />}

      {reportQuery.data && (
        <>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>מגיעים</CardTitle>
              </CardHeader>
              <CardContent className='text-3xl font-bold'>
                {reportQuery.data.summary.attending}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>מנות</CardTitle>
              </CardHeader>
              <CardContent className='text-3xl font-bold'>
                {reportQuery.data.summary.meals}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>ילדים</CardTitle>
              </CardHeader>
              <CardContent className='text-3xl font-bold'>
                {reportQuery.data.summary.children}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>הגבלות תזונה</CardTitle>
              </CardHeader>
              <CardContent className='text-3xl font-bold'>
                {reportQuery.data.summary.dietary}
              </CardContent>
            </Card>
          </div>

          <p className='text-muted-foreground text-xs'>{reportQuery.data.summaryNote}</p>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>מנות מתוכננות לפי קבוצה</CardTitle>
            </CardHeader>
            <CardContent className='flex flex-col gap-3'>
              {plans.length > 0 && (
                <div className='overflow-x-auto rounded-xl border'>
                  <table className='w-full text-right text-sm'>
                    <thead className='bg-muted/50'>
                      <tr>
                        <th className='p-2 font-semibold'>הקבוצה</th>
                        <th className='p-2 font-semibold'>מתוכנן</th>
                        <th className='p-2 font-semibold'>בפועל</th>
                        <th className='p-2 font-semibold'>נספר</th>
                        <th className='p-2 font-semibold'></th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((plan) => {
                        const actual = actualMealsByGroup.get(plan.groupName)
                        const isEditing = editingGroupName === plan.groupName
                        return (
                          <tr key={plan.groupName} className='border-t'>
                            <td className='p-2'>{plan.groupName}</td>
                            <td className='p-2'>
                              {isEditing ? (
                                <Input
                                  type='number'
                                  min={0}
                                  step={1}
                                  value={editHeadcount}
                                  onChange={(event) => setEditHeadcount(event.target.value)}
                                  className='w-24'
                                  autoFocus
                                />
                              ) : (
                                plan.plannedHeadcount
                              )}
                            </td>
                            <td className='p-2'>{actual?.actualMeals ?? 0}</td>
                            <td className='p-2'>{actual?.usedMeals ?? plan.plannedHeadcount}</td>
                            <td className='p-2'>
                              <div className='flex justify-end gap-1'>
                                {isEditing ? (
                                  <Button
                                    type='button'
                                    size='sm'
                                    onClick={() => {
                                      const parsed = Number.parseInt(editHeadcount, 10)
                                      if (Number.isNaN(parsed) || parsed < 0) return
                                      setPlanMutation.mutate({
                                        groupName: plan.groupName,
                                        plannedHeadcount: parsed,
                                      })
                                    }}
                                    disabled={setPlanMutation.isPending}
                                  >
                                    שמירה
                                  </Button>
                                ) : (
                                  <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    onClick={() => {
                                      setEditingGroupName(plan.groupName)
                                      setEditHeadcount(String(plan.plannedHeadcount))
                                    }}
                                    aria-label='עריכה'
                                  >
                                    <Pencil className='h-4 w-4' aria-hidden='true' />
                                  </Button>
                                )}
                                <Button
                                  type='button'
                                  size='sm'
                                  variant='outline'
                                  onClick={() => deletePlanMutation.mutate({ groupName: plan.groupName })}
                                  disabled={deletePlanMutation.isPending}
                                  aria-label='מחיקה'
                                >
                                  <Trash2 className='h-4 w-4' aria-hidden='true' />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {unplannedGroupNames.length > 0 && (
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                  <Select value={newGroupName} onValueChange={setNewGroupName}>
                    <SelectTrigger className='sm:w-56' aria-label='בחירת קבוצה'>
                      <SelectValue placeholder='הוספת קבוצה' />
                    </SelectTrigger>
                    <SelectContent>
                      {unplannedGroupNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type='number'
                    min={0}
                    step={1}
                    value={newHeadcount}
                    onChange={(event) => setNewHeadcount(event.target.value)}
                    placeholder='מספר מנות'
                    className='sm:w-32'
                  />
                  <Button
                    type='button'
                    size='sm'
                    disabled={!newGroupName || setPlanMutation.isPending}
                    onClick={() => {
                      const parsed = Number.parseInt(newHeadcount, 10)
                      if (!newGroupName || Number.isNaN(parsed) || parsed < 0) return
                      setPlanMutation.mutate({ groupName: newGroupName, plannedHeadcount: parsed })
                    }}
                  >
                    <Plus className='me-1 h-4 w-4' aria-hidden='true' />
                    הוספה
                  </Button>
                </div>
              )}

              {plans.length === 0 && unplannedGroupNames.length === 0 && (
                <p className='text-muted-foreground text-xs'>אין קבוצות זמינות להוספת תוכנית מנות.</p>
              )}
            </CardContent>
          </Card>

          <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='חיפוש לפי שם אורח או משק בית'
              className='sm:w-72'
            />
            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                size='sm'
                variant={onlyKidsMenu ? 'default' : 'outline'}
                onClick={() => setOnlyKidsMenu((value) => !value)}
              >
                הצג רק ילדים
              </Button>
              <Button
                type='button'
                size='sm'
                variant={onlyDietary ? 'default' : 'outline'}
                onClick={() => setOnlyDietary((value) => !value)}
              >
                הצג רק הגבלות תזונה
              </Button>
            </div>
          </div>

          <div className='overflow-x-auto rounded-2xl border'>
            <table className='w-full text-right text-sm'>
              <thead className='bg-muted/50'>
                <tr>
                  <th className='p-3 font-semibold'>שם האורח</th>
                  <th className='p-3 font-semibold'>משק בית</th>
                  {hasSeating && <th className='p-3 font-semibold'>שולחן</th>}
                  <th className='p-3 font-semibold'>הערה</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.guestId} className='border-t'>
                    <td className='p-3'>{row.guestName}</td>
                    <td className='p-3'>{row.householdName}</td>
                    {hasSeating && <td className='p-3'>{row.tableName ?? '—'}</td>}
                    <td className='p-3'>
                      {row.isChild && row.dietaryNote
                        ? `ילדים · ${row.dietaryNote}`
                        : row.isChild
                          ? 'ילדים'
                          : row.dietaryNote ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <AsyncState isEmpty emptyText='אין אורחים מתאימים לסינון הנוכחי.' className='p-4' />
            )}
          </div>
        </>
      )}
    </div>
  )
}
