'use client'

import { Download } from 'lucide-react'
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
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
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
                <CardTitle className='text-base'>מנות ילדים</CardTitle>
              </CardHeader>
              <CardContent className='text-3xl font-bold'>
                {reportQuery.data.summary.kidsMeals}
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
                הצג רק תפריט ילדים
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
                        ? `מנת ילדים · ${row.dietaryNote}`
                        : row.isChild
                          ? 'מנת ילדים'
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
