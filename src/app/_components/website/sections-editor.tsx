'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { SingleImageUpload } from '~/app/_components/website/image-upload'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Switch } from '~/components/ui/switch'
import { Textarea } from '~/components/ui/textarea'
import { SECTION_COPY } from '~/i18n/section-copy'
import {
  SECTION_CATALOG,
  type SectionCatalogEntry,
} from '~/server/domains/website-section/website-section.catalog'
import type {
  DestinationSectionContent,
  ExperiencesSectionContent,
  FaqSectionContent,
  InvitationSectionContent,
  OurStorySectionContent,
  RegistrySectionContent,
  SaveTheDateSectionContent,
  TimelineSectionContent,
  TravelSectionContent,
  WebsiteSection,
  WebsiteSectionContent,
  WebsiteSectionType,
  WeddingPartySectionContent,
} from '~/server/domains/website-section/website-section.types'
import { api } from '~/trpc/react'

type SectionsEditorProps = Readonly<{
  initialSections: WebsiteSection[]
}>

const labelClass = 'font-mono text-[0.6rem] text-foreground/55 uppercase tracking-[0.18em]'

/** Return a copy of `items` with the item at `index` patched on a single key. */
function updateAt<T, K extends keyof T>(items: T[], index: number, key: K, value: T[K]): T[] {
  return items.map((item, i) => (i === index ? { ...item, [key]: value } : item))
}

/** Editable section types — HOME is handled by the Welcome editor. */
const EDITABLE_SECTIONS = SECTION_CATALOG.filter((entry) => entry.type !== 'HOME')

/** Resolve the Hebrew label/description for a section, falling back to the catalog default. */
function resolveSectionCopy(entry: SectionCatalogEntry): { label: string; description: string } {
  return SECTION_COPY.he[entry.type] ?? { label: entry.label, description: entry.description }
}

export function SectionsEditor({ initialSections }: SectionsEditorProps) {
  const byType = new Map(initialSections.map((section) => [section.type, section]))

  return (
    <Card className='border-border/80 bg-card/80'>
      <CardHeader className='space-y-2'>
        <p className={labelClass}>מקטעים</p>
        <h3 className='font-serif text-2xl text-foreground'>בנו את אתר החתונה שלכם</h3>
        <p className='max-w-2xl font-sans text-muted-foreground text-sm leading-6'>
          הוסיפו את המקטעים שחשובים לאורחים. כל מקטע מעוצב אוטומטית לפי התבנית שבחרתם. הפעילו
          מקטע כדי לפרסם אותו בעמוד הציבורי.
        </p>
      </CardHeader>
      <CardContent className='space-y-4'>
        {EDITABLE_SECTIONS.map((entry) => {
          const existing = byType.get(entry.type)
          return (
            <SectionCard
              key={entry.type}
              entry={entry}
              initialContent={(existing?.content as WebsiteSectionContent) ?? entry.defaultContent}
              initialEnabled={existing?.isEnabled ?? entry.defaultEnabled}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}

type SectionCardProps = {
  entry: SectionCatalogEntry
  initialContent: WebsiteSectionContent
  initialEnabled: boolean
}

function SectionCard({ entry, initialContent, initialEnabled }: SectionCardProps) {
  const router = useRouter()
  const [content, setContent] = useState<WebsiteSectionContent>(initialContent)
  const [isEnabled, setIsEnabled] = useState(initialEnabled)
  const [baseline, setBaseline] = useState(() => JSON.stringify({ initialContent, initialEnabled }))
  const { label, description } = resolveSectionCopy(entry)

  const upsertSection = api.websiteSection.upsertSection.useMutation({
    onError: (error) => {
      toast.error(error.message || `לא ניתן לשמור את המקטע ${label}.`)
    },
    onSuccess: () => {
      toast.success(`המקטע ${label} נשמר`)
      setBaseline(JSON.stringify({ initialContent: content, initialEnabled: isEnabled }))
      router.refresh()
    },
  })

  const hasChanges =
    baseline !== JSON.stringify({ initialContent: content, initialEnabled: isEnabled })

  const save = () => {
    upsertSection.mutate({
      type: entry.type,
      content,
      isEnabled,
    })
  }

  return (
    <div className='space-y-4 rounded-[10px] border border-border/80 bg-background/60 p-4'>
      <div className='flex items-start justify-between gap-4'>
        <div className='space-y-1'>
          <p className='font-serif text-foreground text-lg'>{label}</p>
          <p className='font-sans text-muted-foreground text-sm leading-6'>{description}</p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <span className={labelClass}>{isEnabled ? 'פעיל' : 'כבוי'}</span>
          <Switch
            aria-label={`הפעלת המקטע ${label}`}
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
        </div>
      </div>

      <SectionFields type={entry.type} content={content} onChange={setContent} />

      <div className='flex justify-end'>
        <Button disabled={!hasChanges || upsertSection.isPending} onClick={save} size='sm'>
          {upsertSection.isPending ? 'שומר…' : 'שמירה'}
        </Button>
      </div>
    </div>
  )
}

type SectionFieldsProps = {
  type: WebsiteSectionType
  content: WebsiteSectionContent
  onChange: (content: WebsiteSectionContent) => void
}

function SectionFields({ type, content, onChange }: SectionFieldsProps) {
  switch (type) {
    case 'OUR_STORY':
      return <ProseFields content={content as OurStorySectionContent} onChange={onChange} />
    case 'TIMELINE':
      return <TimelineFields content={content as TimelineSectionContent} onChange={onChange} />
    case 'DESTINATION':
      return (
        <DestinationFields content={content as DestinationSectionContent} onChange={onChange} />
      )
    case 'EXPERIENCES':
      return (
        <ExperiencesFields content={content as ExperiencesSectionContent} onChange={onChange} />
      )
    case 'TRAVEL':
      return <TravelFields content={content as TravelSectionContent} onChange={onChange} />
    case 'WEDDING_PARTY':
      return (
        <WeddingPartyFields content={content as WeddingPartySectionContent} onChange={onChange} />
      )
    case 'FAQ':
      return <FaqFields content={content as FaqSectionContent} onChange={onChange} />
    case 'REGISTRY':
      return <RegistryFields content={content as RegistrySectionContent} onChange={onChange} />
    case 'SAVE_THE_DATE':
      return (
        <SaveTheDateFields content={content as SaveTheDateSectionContent} onChange={onChange} />
      )
    case 'INVITATION':
      return <InvitationFields content={content as InvitationSectionContent} onChange={onChange} />
    default:
      return null
  }
}

function HeadingField({ value, onChange }: { value: string; onChange: (heading: string) => void }) {
  return (
    <div className='space-y-1.5'>
      <span className={labelClass}>כותרת</span>
      <Input
        maxLength={120}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder='כותרת המקטע'
      />
    </div>
  )
}

function ProseFields({
  content,
  onChange,
}: {
  content: OurStorySectionContent
  onChange: (content: WebsiteSectionContent) => void
}) {
  return (
    <div className='space-y-3'>
      <HeadingField
        value={content.heading}
        onChange={(heading) => onChange({ ...content, heading })}
      />
      <div className='space-y-1.5'>
        <span className={labelClass}>תוכן</span>
        <Textarea
          maxLength={4000}
          rows={5}
          value={content.body}
          onChange={(event) => onChange({ ...content, body: event.target.value })}
          placeholder='כתבו כמה פסקאות. הפרידו בין פסקאות בשורה ריקה.'
        />
      </div>
    </div>
  )
}

function WeddingPartyFields({
  content,
  onChange,
}: {
  content: WeddingPartySectionContent
  onChange: (content: WebsiteSectionContent) => void
}) {
  const updateMember = (
    index: number,
    key: 'name' | 'role' | 'imageUrl' | 'blurb',
    value: string | undefined
  ) => {
    onChange({ ...content, members: updateAt(content.members, index, key, value) })
  }

  return (
    <div className='space-y-3'>
      <HeadingField
        value={content.heading}
        onChange={(heading) => onChange({ ...content, heading })}
      />
      <div className='space-y-3'>
        {content.members.map((member, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: positional editable rows; field values are controlled by state
            key={index}
            className='space-y-2 rounded-[8px] border border-border/70 p-3'
          >
            <div className='flex items-center gap-2'>
              <Input
                value={member.name}
                maxLength={120}
                placeholder='שם'
                onChange={(event) => updateMember(index, 'name', event.target.value)}
              />
              <Input
                value={member.role}
                maxLength={120}
                placeholder='תפקיד (למשל שושבינה ראשית)'
                onChange={(event) => updateMember(index, 'role', event.target.value)}
              />
              <RemoveRowButton
                label='הסרת חבר'
                onClick={() =>
                  onChange({
                    ...content,
                    members: content.members.filter((_, i) => i !== index),
                  })
                }
              />
            </div>
            <div className='space-y-1.5'>
              <span className={labelClass}>תמונה (אופציונלי)</span>
              <SingleImageUpload
                value={member.imageUrl ?? null}
                onChange={(url) => updateMember(index, 'imageUrl', url ?? undefined)}
                aspectClassName='aspect-square max-w-[8rem]'
                label='הוסיפו תמונה'
              />
            </div>
            <Textarea
              value={member.blurb ?? ''}
              maxLength={1000}
              rows={3}
              placeholder='כמה מילים עליהם ועל הקשר שלהם לזוג (אופציונלי)'
              onChange={(event) => updateMember(index, 'blurb', event.target.value || undefined)}
            />
          </div>
        ))}
      </div>
      <AddRowButton
        label='הוסיפו חבר'
        disabled={content.members.length >= 30}
        onClick={() =>
          onChange({ ...content, members: [...content.members, { name: '', role: '' }] })
        }
      />
    </div>
  )
}

function FaqFields({
  content,
  onChange,
}: {
  content: FaqSectionContent
  onChange: (content: WebsiteSectionContent) => void
}) {
  const updateItem = (index: number, key: 'question' | 'answer', value: string) => {
    onChange({ ...content, items: updateAt(content.items, index, key, value) })
  }

  return (
    <div className='space-y-3'>
      <HeadingField
        value={content.heading}
        onChange={(heading) => onChange({ ...content, heading })}
      />
      <div className='space-y-3'>
        {content.items.map((item, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: positional editable rows; field values are controlled by state
            key={index}
            className='space-y-2 rounded-[8px] border border-border/70 p-3'
          >
            <div className='flex items-center gap-2'>
              <Input
                value={item.question}
                maxLength={300}
                placeholder='שאלה'
                onChange={(event) => updateItem(index, 'question', event.target.value)}
              />
              <RemoveRowButton
                label='הסרת שאלה'
                onClick={() =>
                  onChange({ ...content, items: content.items.filter((_, i) => i !== index) })
                }
              />
            </div>
            <Textarea
              value={item.answer}
              maxLength={2000}
              rows={2}
              placeholder='תשובה'
              onChange={(event) => updateItem(index, 'answer', event.target.value)}
            />
          </div>
        ))}
      </div>
      <AddRowButton
        label='הוסיפו שאלה'
        disabled={content.items.length >= 30}
        onClick={() =>
          onChange({ ...content, items: [...content.items, { question: '', answer: '' }] })
        }
      />
    </div>
  )
}

function RegistryFields({
  content,
  onChange,
}: {
  content: RegistrySectionContent
  onChange: (content: WebsiteSectionContent) => void
}) {
  const updateLink = (index: number, key: 'label' | 'url', value: string) => {
    onChange({ ...content, links: updateAt(content.links, index, key, value) })
  }

  return (
    <div className='space-y-3'>
      <HeadingField
        value={content.heading}
        onChange={(heading) => onChange({ ...content, heading })}
      />
      <div className='space-y-1.5'>
        <span className={labelClass}>הערה</span>
        <Textarea
          maxLength={2000}
          rows={3}
          value={content.body}
          onChange={(event) => onChange({ ...content, body: event.target.value })}
          placeholder='הערה קצרה על מתנות או רשימות מתנות.'
        />
      </div>
      <div className='space-y-2'>
        {content.links.map((link, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: positional editable rows; field values are controlled by state
            key={index}
            className='flex items-center gap-2'
          >
            <Input
              value={link.label}
              maxLength={120}
              placeholder='תווית (למשל Amazon)'
              onChange={(event) => updateLink(index, 'label', event.target.value)}
            />
            <Input
              value={link.url}
              maxLength={500}
              placeholder='https://…'
              onChange={(event) => updateLink(index, 'url', event.target.value)}
            />
            <RemoveRowButton
              label='הסרת קישור'
              onClick={() =>
                onChange({ ...content, links: content.links.filter((_, i) => i !== index) })
              }
            />
          </div>
        ))}
      </div>
      <AddRowButton
        label='הוסיפו קישור'
        disabled={content.links.length >= 20}
        onClick={() => onChange({ ...content, links: [...content.links, { label: '', url: '' }] })}
      />
    </div>
  )
}

function TextField({
  label,
  value,
  placeholder,
  maxLength,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  maxLength?: number
  onChange: (value: string) => void
}) {
  return (
    <div className='space-y-1.5'>
      <span className={labelClass}>{label}</span>
      <Input
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function TimelineFields({
  content,
  onChange,
}: {
  content: TimelineSectionContent
  onChange: (content: WebsiteSectionContent) => void
}) {
  const updateMilestone = (
    index: number,
    key: 'year' | 'title' | 'location',
    value: string | undefined
  ) => {
    onChange({ ...content, milestones: updateAt(content.milestones, index, key, value) })
  }

  return (
    <div className='space-y-3'>
      <TextField
        label='כותרת משנה עליונה (אופציונלי)'
        value={content.eyebrow ?? ''}
        maxLength={60}
        placeholder='הסיפור שלנו'
        onChange={(eyebrow) => onChange({ ...content, eyebrow: eyebrow || undefined })}
      />
      <HeadingField
        value={content.heading}
        onChange={(heading) => onChange({ ...content, heading })}
      />
      <div className='space-y-3'>
        {content.milestones.map((milestone, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: positional editable rows; field values are controlled by state
            key={index}
            className='flex items-center gap-2 rounded-[8px] border border-border/70 p-3'
          >
            <Input
              value={milestone.year}
              maxLength={40}
              placeholder='2018'
              className='max-w-[6rem]'
              onChange={(event) => updateMilestone(index, 'year', event.target.value)}
            />
            <Input
              value={milestone.title}
              maxLength={120}
              placeholder='הפגישה הראשונה'
              onChange={(event) => updateMilestone(index, 'title', event.target.value)}
            />
            <Input
              value={milestone.location ?? ''}
              maxLength={120}
              placeholder='ניו יורק, ארה״ב'
              onChange={(event) =>
                updateMilestone(index, 'location', event.target.value || undefined)
              }
            />
            <RemoveRowButton
              label='הסרת אבן דרך'
              onClick={() =>
                onChange({
                  ...content,
                  milestones: content.milestones.filter((_, i) => i !== index),
                })
              }
            />
          </div>
        ))}
      </div>
      <AddRowButton
        label='הוסיפו אבן דרך'
        disabled={content.milestones.length >= 12}
        onClick={() =>
          onChange({
            ...content,
            milestones: [...content.milestones, { year: '', title: '' }],
          })
        }
      />
    </div>
  )
}

function DestinationFields({
  content,
  onChange,
}: {
  content: DestinationSectionContent
  onChange: (content: WebsiteSectionContent) => void
}) {
  return (
    <div className='space-y-3'>
      <TextField
        label='כותרת משנה עליונה (אופציונלי)'
        value={content.eyebrow ?? ''}
        maxLength={60}
        placeholder='היעד'
        onChange={(eyebrow) => onChange({ ...content, eyebrow: eyebrow || undefined })}
      />
      <HeadingField
        value={content.heading}
        onChange={(heading) => onChange({ ...content, heading })}
      />
      <div className='space-y-1.5'>
        <span className={labelClass}>תיאור</span>
        <Textarea
          maxLength={2000}
          rows={4}
          value={content.body}
          onChange={(event) => onChange({ ...content, body: event.target.value })}
          placeholder='כמה שורות על העיר, התרבות ולמה בחרתם בה.'
        />
      </div>
      <TextField
        label='מיקום (אופציונלי)'
        value={content.location ?? ''}
        maxLength={120}
        placeholder='פואבלה, מקסיקו'
        onChange={(location) => onChange({ ...content, location: location || undefined })}
      />
      <TextField
        label='שם המקום (אופציונלי)'
        value={content.venueName ?? ''}
        maxLength={160}
        placeholder='Hacienda San José Actipan'
        onChange={(venueName) => onChange({ ...content, venueName: venueName || undefined })}
      />
      <TextField
        label='הערה על המקום (אופציונלי)'
        value={content.venueNote ?? ''}
        maxLength={200}
        placeholder='קסם היסטורי וחוויה בלעדית.'
        onChange={(venueNote) => onChange({ ...content, venueNote: venueNote || undefined })}
      />
      <div className='flex gap-2'>
        <TextField
          label='טקסט הכפתור (אופציונלי)'
          value={content.ctaLabel ?? ''}
          maxLength={60}
          placeholder='גלו את פואבלה'
          onChange={(ctaLabel) => onChange({ ...content, ctaLabel: ctaLabel || undefined })}
        />
        <TextField
          label='קישור הכפתור (אופציונלי)'
          value={content.ctaUrl ?? ''}
          maxLength={1000}
          placeholder='https://…'
          onChange={(ctaUrl) => onChange({ ...content, ctaUrl: ctaUrl || undefined })}
        />
      </div>
      <div className='space-y-1.5'>
        <span className={labelClass}>תמונה מרכזית (אופציונלי)</span>
        <SingleImageUpload
          value={content.imageUrl ?? null}
          onChange={(url) => onChange({ ...content, imageUrl: url ?? undefined })}
          aspectClassName='aspect-[4/3] max-w-[18rem]'
          label='הוסיפו תמונה'
        />
      </div>
    </div>
  )
}

function ExperiencesFields({
  content,
  onChange,
}: {
  content: ExperiencesSectionContent
  onChange: (content: WebsiteSectionContent) => void
}) {
  const updateItem = (
    index: number,
    key: 'title' | 'description' | 'imageUrl',
    value: string | undefined
  ) => {
    onChange({ ...content, items: updateAt(content.items, index, key, value) })
  }

  return (
    <div className='space-y-3'>
      <TextField
        label='כותרת משנה עליונה (אופציונלי)'
        value={content.eyebrow ?? ''}
        maxLength={60}
        placeholder='חוויות נבחרות'
        onChange={(eyebrow) => onChange({ ...content, eyebrow: eyebrow || undefined })}
      />
      <HeadingField
        value={content.heading}
        onChange={(heading) => onChange({ ...content, heading })}
      />
      <div className='space-y-3'>
        {content.items.map((item, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: positional editable rows; field values are controlled by state
            key={index}
            className='space-y-2 rounded-[8px] border border-border/70 p-3'
          >
            <div className='flex items-center gap-2'>
              <Input
                value={item.title}
                maxLength={120}
                placeholder='הטקס'
                onChange={(event) => updateItem(index, 'title', event.target.value)}
              />
              <RemoveRowButton
                label='הסרת חוויה'
                onClick={() =>
                  onChange({ ...content, items: content.items.filter((_, i) => i !== index) })
                }
              />
            </div>
            <Input
              value={item.description ?? ''}
              maxLength={300}
              placeholder='רגע שלא נשכח לעולם'
              onChange={(event) =>
                updateItem(index, 'description', event.target.value || undefined)
              }
            />
            <div className='space-y-1.5'>
              <span className={labelClass}>תמונה (אופציונלי)</span>
              <SingleImageUpload
                value={item.imageUrl ?? null}
                onChange={(url) => updateItem(index, 'imageUrl', url ?? undefined)}
                aspectClassName='aspect-[4/3] max-w-[12rem]'
                label='הוסיפו תמונה'
              />
            </div>
          </div>
        ))}
      </div>
      <AddRowButton
        label='הוסיפו חוויה'
        disabled={content.items.length >= 12}
        onClick={() => onChange({ ...content, items: [...content.items, { title: '' }] })}
      />
    </div>
  )
}

function TravelFields({
  content,
  onChange,
}: {
  content: TravelSectionContent
  onChange: (content: WebsiteSectionContent) => void
}) {
  const services = content.services ?? []
  const stays = content.stays ?? []

  const updateService = (index: number, key: 'title' | 'description', value: string) => {
    onChange({ ...content, services: updateAt(services, index, key, value) })
  }

  const updateStay = (
    index: number,
    key: 'name' | 'description' | 'imageUrl' | 'url' | 'blurb' | 'buttonLabel',
    value: string | undefined
  ) => {
    onChange({ ...content, stays: updateAt(stays, index, key, value) })
  }

  return (
    <div className='space-y-3'>
      <HeadingField
        value={content.heading}
        onChange={(heading) => onChange({ ...content, heading })}
      />
      <div className='space-y-1.5'>
        <span className={labelClass}>פתיח</span>
        <Textarea
          maxLength={4000}
          rows={4}
          value={content.body}
          onChange={(event) => onChange({ ...content, body: event.target.value })}
          placeholder='מידע על ההגעה לאורחים. הפרידו בין פסקאות בשורה ריקה.'
        />
      </div>

      <div className='space-y-2'>
        <span className={labelClass}>שירותים (אופציונלי)</span>
        {services.map((service, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: positional editable rows; field values are controlled by state
            key={index}
            className='flex items-center gap-2'
          >
            <Input
              value={service.title}
              maxLength={120}
              placeholder='הסעות פרטיות'
              className='max-w-[12rem]'
              onChange={(event) => updateService(index, 'title', event.target.value)}
            />
            <Input
              value={service.description}
              maxLength={300}
              placeholder='הסעות משדה התעופה לאורך כל סוף השבוע.'
              onChange={(event) => updateService(index, 'description', event.target.value)}
            />
            <RemoveRowButton
              label='הסרת שירות'
              onClick={() =>
                onChange({ ...content, services: services.filter((_, i) => i !== index) })
              }
            />
          </div>
        ))}
        <AddRowButton
          label='הוסיפו שירות'
          disabled={services.length >= 8}
          onClick={() =>
            onChange({ ...content, services: [...services, { title: '', description: '' }] })
          }
        />
      </div>

      <div className='space-y-2'>
        <span className={labelClass}>מקומות לינה מומלצים (אופציונלי)</span>
        {stays.map((stay, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: positional editable rows; field values are controlled by state
            key={index}
            className='space-y-2 rounded-[8px] border border-border/70 p-3'
          >
            <div className='flex items-center gap-2'>
              <Input
                value={stay.name}
                maxLength={160}
                placeholder='Quinta Real Puebla'
                onChange={(event) => updateStay(index, 'name', event.target.value)}
              />
              <RemoveRowButton
                label='הסרת מקום לינה'
                onClick={() => onChange({ ...content, stays: stays.filter((_, i) => i !== index) })}
              />
            </div>
            <Input
              value={stay.description ?? ''}
              maxLength={300}
              placeholder='אלגנטיות קולוניאלית ונוחות מודרנית'
              onChange={(event) =>
                updateStay(index, 'description', event.target.value || undefined)
              }
            />
            <div className='space-y-1.5'>
              <span className={labelClass}>תמונה (אופציונלי)</span>
              <SingleImageUpload
                value={stay.imageUrl ?? null}
                onChange={(url) => updateStay(index, 'imageUrl', url ?? undefined)}
                aspectClassName='aspect-[4/3] max-w-[12rem]'
                label='הוסיפו תמונה'
              />
            </div>
            <Textarea
              value={stay.blurb ?? ''}
              maxLength={1000}
              rows={3}
              placeholder='תיאור מורחב שמוצג כשהאורחים לוחצים על הכרטיס, למשל למה אתם ממליצים על המקום (אופציונלי)'
              onChange={(event) => updateStay(index, 'blurb', event.target.value || undefined)}
            />
            <div className='flex items-center gap-2'>
              <Input
                value={stay.url ?? ''}
                maxLength={1000}
                placeholder='https://…'
                onChange={(event) => updateStay(index, 'url', event.target.value || undefined)}
              />
              <Input
                value={stay.buttonLabel ?? ''}
                maxLength={60}
                placeholder='טקסט הכפתור (למשל לאתר המלון)'
                onChange={(event) =>
                  updateStay(index, 'buttonLabel', event.target.value || undefined)
                }
              />
            </div>
          </div>
        ))}
        <AddRowButton
          label='הוסיפו מקום לינה'
          disabled={stays.length >= 8}
          onClick={() => onChange({ ...content, stays: [...stays, { name: '' }] })}
        />
      </div>
    </div>
  )
}

function SaveTheDateFields({
  content,
  onChange,
}: {
  content: SaveTheDateSectionContent
  onChange: (content: WebsiteSectionContent) => void
}) {
  return (
    <div className='space-y-3'>
      <TextField
        label='תווית (אופציונלי)'
        value={content.eyebrow ?? ''}
        maxLength={60}
        placeholder='שמרו את התאריך'
        onChange={(eyebrow) => onChange({ ...content, eyebrow: eyebrow || undefined })}
      />
      <div className='space-y-1.5'>
        <span className={labelClass}>הודעה (אופציונלי)</span>
        <Textarea
          maxLength={600}
          rows={3}
          value={content.message ?? ''}
          onChange={(event) => onChange({ ...content, message: event.target.value || undefined })}
          placeholder="הודעה קצרה לאורחים, למשל ״מחכים לחגוג איתכם.״"
        />
      </div>
      <TextField
        label='הערת שוליים (אופציונלי)'
        value={content.footnote ?? ''}
        maxLength={160}
        placeholder='הזמנה רשמית תישלח בהמשך.'
        onChange={(footnote) => onChange({ ...content, footnote: footnote || undefined })}
      />
    </div>
  )
}

function InvitationFields({
  content,
  onChange,
}: {
  content: InvitationSectionContent
  onChange: (content: WebsiteSectionContent) => void
}) {
  return (
    <div className='space-y-3'>
      <TextField
        label='שורת פתיחה (אופציונלי)'
        value={content.preface ?? ''}
        maxLength={160}
        placeholder='יחד עם משפחותיהם'
        onChange={(preface) => onChange({ ...content, preface: preface || undefined })}
      />
      <TextField
        label='שורת ההזמנה (אופציונלי)'
        value={content.invitationLine ?? ''}
        maxLength={200}
        placeholder='שמחים להזמינכם'
        onChange={(invitationLine) =>
          onChange({ ...content, invitationLine: invitationLine || undefined })
        }
      />
      <div className='space-y-1.5'>
        <span className={labelClass}>הודעה (אופציונלי)</span>
        <Textarea
          maxLength={600}
          rows={3}
          value={content.message ?? ''}
          onChange={(event) => onChange({ ...content, message: event.target.value || undefined })}
          placeholder='הערת סיום אופציונלית שמוצגת מעל כפתור אישור ההגעה.'
        />
      </div>
    </div>
  )
}

function AddRowButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button type='button' variant='outline' size='sm' onClick={onClick} disabled={disabled}>
      <Plus aria-hidden='true' className='h-4 w-4' />
      {label}
    </Button>
  )
}

function RemoveRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      aria-label={label}
      onClick={onClick}
      className='shrink-0 text-muted-foreground hover:text-destructive'
    >
      <Trash2 aria-hidden='true' className='h-4 w-4' />
    </Button>
  )
}
