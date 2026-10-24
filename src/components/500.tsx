import Footer from '~/components/footer'
import Navbar from '~/components/navbar'

export default function SomethingWentWrongPage() {
  return (
    <>
      <Navbar />
      <div className='flex min-h-96 items-center justify-center'>
        <div className='flex flex-col gap-5 text-center'>
          <h1 className='text-3xl'>משהו השתבש!</h1>
          <p>מצטערים, רעננו את הדף בעוד רגע.</p>
          <p>
            צריכים עזרה? <span className='underline'>חפשו במרכז העזרה או פנו אלינו.</span>
          </p>
        </div>
      </div>
      <Footer />
    </>
  )
}
