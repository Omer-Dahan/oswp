import { IoMdClose } from 'react-icons/io'

export default function RsvpPageSkeleton() {
  return (
    <div role='status' className='animate-pulse pt-24 pb-20'>
      <StaticProgressBar />
      <div className='m-auto flex w-full max-w-[450px] flex-col gap-6 px-5 py-8 md:px-0'>
        <div className='h-8 w-3/4 rounded-[8px] bg-muted' />
        <div className='flex flex-col gap-2'>
          <div className='h-4 w-full rounded-[6px] bg-muted' />
          <div className='h-4 w-2/3 rounded-[6px] bg-muted' />
        </div>
        <div className='h-12 w-full rounded-[16px] bg-muted' />
        <div className='h-12 w-full rounded-full bg-muted' />
      </div>
    </div>
  )
}

const StaticProgressBar = () => {
  return (
    <div className='fixed top-0 z-10 w-full bg-background px-10 py-3 text-center'>
      <IoMdClose size={22} className='absolute top-3 end-[4.25rem] z-20 text-foreground/40' />
      <p className='font-[family-name:var(--tpl-body-font)] py-2 text-foreground text-lg tracking-wide'>
        RSVP
      </p>
      <div className='relative h-1 w-full overflow-hidden rounded-full bg-border'>
        <div className='absolute top-0 start-0 h-1 w-[3%] rounded-full bg-primary transition-[width]' />
      </div>
    </div>
  )
}
