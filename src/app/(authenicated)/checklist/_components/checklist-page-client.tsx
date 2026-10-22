'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  bucketTasks,
  filterTasks,
  getChecklistFiltersFromSearchParams,
  getCompletionPercent,
  groupBucketsIntoHorizons,
  hasMilestoneOverrideDivergence,
  type TaskBucketKey,
} from '~/components/checklist/checklist-view-model'
import { MilestoneDetail } from '~/components/checklist/milestone-detail'
import { TaskDialog } from '~/components/checklist/task-dialog'
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
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
  type TaskCategoryValue,
} from '~/lib/constants/task-categories'
import type { EventWithStats } from '~/server/domains/event'
import type { MilestoneWithEffectiveStatus } from '~/server/domains/milestone'
import type { Task } from '~/server/domains/task'
import { api } from '~/trpc/react'

const STATUS_FILTER_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'הכל', value: 'all' },
] as const

type ChecklistPageClientProps = Readonly<{
  initialTasks: Task[]
  initialMilestones: MilestoneWithEffectiveStatus[]
  initialEvents: EventWithStats[]
}>

export function ChecklistPageClient({
  initialTasks,
  initialMilestones,
  initialEvents,
}: ChecklistPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const filters = getChecklistFiltersFromSearchParams(searchParams)
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<TaskBucketKey>>(
    () => new Set(['done'])
  )
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const utils = api.useUtils()

  const { data: tasks = initialTasks } = api.task.list.useQuery(
    {},
    {
      initialData: initialTasks,
      staleTime: 30_000,
    }
  )
  const { data: milestones = initialMilestones } = api.milestone.getAll.useQuery(
    {},
    {
      initialData: initialMilestones,
      staleTime: 30_000,
    }
  )
  const { data: events = initialEvents } = api.event.getAllByUserIdWithStats.useQuery(undefined, {
    initialData: initialEvents,
    staleTime: 30_000,
  })

  const filteredTasks = useMemo(() => filterTasks(tasks, filters), [filters, tasks])
  const buckets = useMemo(() => bucketTasks(filteredTasks), [filteredTasks])
  const { horizons, done } = useMemo(() => groupBucketsIntoHorizons(buckets), [buckets])
  const completionPercent = getCompletionPercent(tasks)
  const hasDefaultFilters =
    filters.category === 'all' && filters.eventId === 'all' && filters.status === 'all'
  const hasActiveTasks = tasks.some((task) => !task.completed)

  const completeTask = api.task.complete.useMutation({
    onSuccess: () => {
      void Promise.all([
        utils.task.list.invalidate(),
        utils.task.getPriorityQueue.invalidate(),
        utils.dashboard.getForActiveWorkspace.invalidate(),
      ])
    },
    onError: () => toast.error('עדכון המשימה נכשל'),
  })
  const createTask = api.task.create.useMutation({
    onSuccess: () => {
      setIsCreateDialogOpen(false)
      void Promise.all([
        utils.task.list.invalidate(),
        utils.task.getPriorityQueue.invalidate(),
        utils.dashboard.getForActiveWorkspace.invalidate(),
      ])
    },
    onError: () => toast.error('יצירת המשימה נכשלה'),
  })
  const updateTask = api.task.update.useMutation({
    onSuccess: () => {
      setEditingTask(null)
      void Promise.all([
        utils.task.list.invalidate(),
        utils.task.getPriorityQueue.invalidate(),
        utils.dashboard.getForActiveWorkspace.invalidate(),
      ])
    },
    onError: () => toast.error('עדכון המשימה נכשל'),
  })
  const deleteTask = api.task.delete.useMutation({
    onSuccess: () => {
      setDeletingTask(null)
      setEditingTask(null)
      void Promise.all([
        utils.task.list.invalidate(),
        utils.task.getPriorityQueue.invalidate(),
        utils.dashboard.getForActiveWorkspace.invalidate(),
      ])
    },
    onError: () => toast.error('מחיקת המשימה נכשלה'),
  })

  const attestMilestone = api.milestone.attest.useMutation({
    onSuccess: () => {
      void Promise.all([
        utils.milestone.getAll.invalidate(),
        utils.dashboard.getForActiveWorkspace.invalidate(),
      ])
    },
    onError: () => toast.error('עדכון אבן הדרך נכשל'),
  })
  const dismissMilestone = api.milestone.dismiss.useMutation({
    onSuccess: () => {
      void Promise.all([
        utils.milestone.getAll.invalidate(),
        utils.dashboard.getForActiveWorkspace.invalidate(),
      ])
    },
    onError: () => toast.error('עדכון אבן הדרך נכשל'),
  })
  const clearMilestoneOverride = api.milestone.clearOverride.useMutation({
    onSuccess: () => {
      void Promise.all([
        utils.milestone.getAll.invalidate(),
        utils.dashboard.getForActiveWorkspace.invalidate(),
      ])
    },
    onError: () => toast.error('עדכון אבן הדרך נכשל'),
  })

  const updateFilter = (key: 'category' | 'eventId' | 'status', value: string) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString())

    if (value === 'all') {
      nextSearchParams.delete(key)
    } else {
      nextSearchParams.set(key, value)
    }

    router.replace(
      nextSearchParams.toString().length > 0
        ? `${pathname}?${nextSearchParams.toString()}`
        : pathname
    )
  }

  const toggleBucket = (bucketKey: TaskBucketKey) => {
    setCollapsedBuckets((current) => {
      const next = new Set(current)

      if (next.has(bucketKey)) {
        next.delete(bucketKey)
      } else {
        next.add(bucketKey)
      }

      return next
    })
  }

  const renderTaskRow = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      onToggle={(completed) => completeTask.mutate({ taskId: task.id, completed })}
      onEdit={() => setEditingTask(task)}
    />
  )

  return (
    <div className='mx-auto max-w-[1180px] space-y-8 pb-6'>
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div className='flex flex-col gap-3'>
          <h2 className='font-display text-5xl text-foreground leading-none'>רשימת המשימות שלכם</h2>
          <div className='flex items-center gap-3'>
            <div
              className='h-1.5 w-40 overflow-hidden rounded-full bg-secondary'
              role='img'
              aria-label={`${completionPercent}% of tasks done`}
            >
              <div
                className='h-full rounded-full bg-primary'
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className='text-muted-foreground text-sm'>{completionPercent}% of tasks done</p>
          </div>
        </div>
        <Button type='button' onClick={() => setIsCreateDialogOpen(true)}>
          הוסיפו משימה
        </Button>
      </div>

      <div className='space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm'>
        <FilterChipGroup label='קטגוריה'>
          <FilterChip
            active={filters.category === 'all'}
            onClick={() => updateFilter('category', 'all')}
          >
            הכל
          </FilterChip>
          {TASK_CATEGORIES.map((category) => (
            <FilterChip
              key={category}
              active={filters.category === category}
              onClick={() => updateFilter('category', category)}
            >
              {TASK_CATEGORY_LABELS[category]}
            </FilterChip>
          ))}
        </FilterChipGroup>
        <FilterChipGroup label='אירוע'>
          <FilterChip
            active={filters.eventId === 'all'}
            onClick={() => updateFilter('eventId', 'all')}
          >
            כל האירועים
          </FilterChip>
          {events.map((event) => (
            <FilterChip
              key={event.id}
              active={filters.eventId === event.id}
              onClick={() => updateFilter('eventId', event.id)}
            >
              {event.name}
            </FilterChip>
          ))}
        </FilterChipGroup>
        <FilterChipGroup label='סטטוס'>
          {STATUS_FILTER_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              active={filters.status === option.value}
              onClick={() => updateFilter('status', option.value)}
            >
              {option.label}
            </FilterChip>
          ))}
        </FilterChipGroup>
      </div>

      {events.length === 0 ? (
        <ChecklistEmptyState
          title='הוסיפו אירוע ראשון כדי לפתוח את רשימת המשימות'
          description='כל משימה שייכת לאירוע, לכן התחילו ביצירת הטקס או האירוע המרכזי.'
          action={{
            href: '/events',
            label: 'Go to events',
          }}
        />
      ) : tasks.length === 0 && hasDefaultFilters ? (
        <ChecklistEmptyState
          title='עדיין לא נוספו משימות'
          description='התחילו עם משימה מותאמת אישית, או תנו לרשימת ברירת המחדל להתפתח מצעדי התכנון הראשונים שלכם.'
          action={{
            label: 'הוסיפו משימה',
            onClick: () => setIsCreateDialogOpen(true),
          }}
        />
      ) : tasks.length > 0 && !hasActiveTasks && filters.status !== 'completed' ? (
        <ChecklistEmptyState
          title='הכל מסומן כבוצע'
          description='אתם מעודכנים לעת עתה. עברו ל׳הושלם׳ כדי לעיין במה שכבר נעשה, או הוסיפו משימה חדשה.'
          action={{
            label: 'הוסיפו משימה',
            onClick: () => setIsCreateDialogOpen(true),
          }}
        />
      ) : buckets.every((bucket) => bucket.tasks.length === 0) ? (
        <ChecklistEmptyState
          title='אין עדיין דבר בתצוגה זו'
          description={
            hasDefaultFilters
              ? 'Adjust the filters or add a task to start shaping the checklist.'
              : 'No tasks match the current filters.'
          }
          action={
            hasDefaultFilters
              ? undefined
              : { label: 'Clear filters', onClick: () => router.replace(pathname) }
          }
        />
      ) : (
        <>
          <div className='flex flex-wrap items-start gap-5'>
            {horizons.map((horizon, index) => (
              <section
                key={horizon.key}
                aria-labelledby={`checklist-horizon-${horizon.key}`}
                className={`flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-2xl p-4 ${
                  index === 0 ? 'bg-blush' : 'bg-secondary'
                }`}
              >
                <div className='flex items-baseline justify-between gap-3 px-1'>
                  <h2
                    id={`checklist-horizon-${horizon.key}`}
                    className='font-semibold text-foreground text-lg'
                  >
                    {horizon.title}
                  </h2>
                  <span className='text-muted-foreground text-sm'>
                    {horizon.hint} · {horizon.taskCount}
                  </span>
                </div>
                {horizon.taskCount === 0 ? (
                  <p className='px-1 text-muted-foreground text-sm'>אין כאן כלום כרגע.</p>
                ) : (
                  horizon.buckets
                    .filter((bucket) => bucket.tasks.length > 0)
                    .map((bucket) => (
                      <div key={bucket.key} className='flex flex-col gap-2'>
                        {horizon.buckets.length > 1 && (
                          <h3 className='px-1 font-medium text-muted-foreground text-xs'>
                            {bucket.title}
                          </h3>
                        )}
                        {bucket.tasks.map(renderTaskRow)}
                      </div>
                    ))
                )}
              </section>
            ))}
          </div>

          {done.tasks.length > 0 && (
            <section className='space-y-2'>
              <button
                type='button'
                aria-label='סל הושלם'
                aria-expanded={!collapsedBuckets.has('done')}
                className='flex w-full items-center gap-3 text-left'
                onClick={() => toggleBucket('done')}
              >
                <h2 className='font-semibold text-foreground text-sm'>הושלם</h2>
                <span className='h-px flex-1 bg-border' />
                <span className='text-muted-foreground text-sm'>
                  {done.tasks.length} · {collapsedBuckets.has('done') ? 'Show' : 'Hide'}
                </span>
              </button>
              {collapsedBuckets.has('done') ? null : (
                <div className='grid gap-2 md:grid-cols-2'>{done.tasks.map(renderTaskRow)}</div>
              )}
            </section>
          )}
        </>
      )}

      {milestones.length > 0 && (
        <section aria-labelledby='checklist-milestones' className='space-y-3'>
          <h2 id='checklist-milestones' className='font-semibold text-foreground text-lg'>
            אבני דרך
          </h2>
          <div className='flex gap-3 overflow-x-auto pb-2'>
            {milestones.map((milestone) => (
              <MilestoneDetail
                key={milestone.id}
                milestone={milestone}
                onAttest={(milestoneId) => attestMilestone.mutate({ milestoneId })}
                onDismiss={(milestoneId) => dismissMilestone.mutate({ milestoneId })}
                onClearOverride={(milestoneId) => clearMilestoneOverride.mutate({ milestoneId })}
                trigger={
                  <button
                    type='button'
                    className='flex min-w-[200px] flex-col rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40'
                  >
                    <span className='text-muted-foreground text-xs'>
                      {TASK_CATEGORY_LABELS[milestone.category as TaskCategoryValue] ??
                        milestone.category}
                    </span>
                    <span className='mt-1.5 font-medium text-foreground text-sm'>
                      {milestone.title}
                    </span>
                    <span className='mt-3 flex items-center gap-2'>
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          milestone.effectiveStatus === 'done'
                            ? 'bg-primary'
                            : 'border border-foreground/30'
                        }`}
                      />
                      <span className='text-muted-foreground text-xs'>
                        {milestone.effectiveStatus === 'done' ? 'הושלם' : 'Pending'}
                      </span>
                      {hasMilestoneOverrideDivergence(milestone) ? (
                        <Badge variant='secondary' className='ml-auto text-[0.65rem]'>
                          ⚠ override
                        </Badge>
                      ) : null}
                    </span>
                  </button>
                }
              />
            ))}
          </div>
        </section>
      )}

      <TaskDialog
        mode='create'
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        events={events}
        isSubmitting={createTask.isPending}
        onSubmit={(data) => createTask.mutate(data)}
      />

      {editingTask ? (
        <TaskDialog
          mode='edit'
          open
          onOpenChange={(open) => !open && setEditingTask(null)}
          events={events}
          task={editingTask}
          isSubmitting={updateTask.isPending}
          onDelete={() => setDeletingTask(editingTask)}
          onSubmit={(data) =>
            updateTask.mutate({
              taskId: editingTask.id,
              ...data,
            })
          }
        />
      ) : null}

      <AlertDialog
        open={deletingTask !== null}
        onOpenChange={(open) => !open && setDeletingTask(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק משימה?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes &quot;{deletingTask?.title ?? 'this task'}&quot; from the checklist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deletingTask) {
                  return
                }
                deleteTask.mutate({ taskId: deletingTask.id })
              }}
            >
              אישור מחיקה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function FilterChipGroup({
  children,
  label,
}: Readonly<{
  children: React.ReactNode
  label: string
}>) {
  return (
    <fieldset className='-mx-1 flex min-w-0 items-center gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible md:pb-0'>
      <legend className='sr-only'>{label}</legend>
      <span aria-hidden='true' className='w-16 flex-shrink-0 text-muted-foreground text-xs'>
        {label}
      </span>
      {children}
    </fieldset>
  )
}

function FilterChip({
  active,
  children,
  onClick,
}: Readonly<{
  active: boolean
  children: React.ReactNode
  onClick: () => void
}>) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[32px] flex-shrink-0 whitespace-nowrap rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? 'border-foreground bg-foreground font-medium text-background'
          : 'border-border bg-card text-foreground hover:bg-secondary'
      }`}
    >
      {children}
    </button>
  )
}

function ChecklistEmptyState({
  title,
  description,
  action,
}: Readonly<{
  title: string
  description: string
  action?: {
    href?: string
    label: string
    onClick?: () => void
  }
}>) {
  return (
    <div className='rounded-2xl border border-border border-dashed bg-card px-4 py-10 text-center'>
      <p className='font-display text-3xl'>{title}</p>
      <p className='mt-2 text-muted-foreground text-sm'>{description}</p>
      {action?.href ? (
        <Link
          href={action.href}
          className='mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-border px-4 font-semibold text-sm transition-colors hover:bg-accent hover:text-accent-foreground'
        >
          {action.label}
        </Link>
      ) : action?.onClick ? (
        <Button type='button' className='mt-4' onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}

function TaskRow({
  task,
  onToggle,
  onEdit,
}: Readonly<{
  task: Task
  onToggle: (completed: boolean) => void
  onEdit: () => void
}>) {
  const dueLabel = task.dueDate
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
        new Date(task.dueDate)
      )
    : null

  return (
    <div className='flex items-start gap-3 rounded-xl bg-card p-3 shadow-sm'>
      <Checkbox
        className='mt-0.5 rounded-full'
        aria-label={`Toggle task ${task.title}`}
        checked={task.completed}
        onCheckedChange={(checked) => onToggle(checked === true)}
      />
      <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
        <span
          className={`text-[0.95rem] leading-snug ${
            task.completed ? 'text-muted-foreground line-through' : 'text-foreground'
          }`}
        >
          {task.title}
        </span>
        <span className='flex flex-wrap gap-1.5 text-xs'>
          <span className='rounded-md bg-accent px-2 py-0.5 text-accent-foreground'>
            {TASK_CATEGORY_LABELS[task.category]}
          </span>
          {dueLabel && (
            <span className='rounded-md bg-secondary px-2 py-0.5 text-secondary-foreground'>
              Due {dueLabel}
            </span>
          )}
        </span>
      </div>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        className='h-8 px-2 text-muted-foreground'
        aria-label={`Edit task ${task.title}`}
        onClick={onEdit}
      >
        עריכה
      </Button>
    </div>
  )
}
