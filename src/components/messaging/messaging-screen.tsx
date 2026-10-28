'use client'

import { SmsMessagingScreen } from '~/components/messaging/sms-messaging-screen'
import { WhatsappMessagingScreen } from '~/components/messaging/whatsapp-messaging-screen'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'

export function MessagingScreen() {
  return (
    <Tabs defaultValue='whatsapp' dir='rtl'>
      <TabsList aria-label='ערוצי הודעות' className='mb-4'>
        <TabsTrigger value='whatsapp'>וואטסאפ</TabsTrigger>
        <TabsTrigger value='sms'>SMS</TabsTrigger>
      </TabsList>
      <TabsContent value='whatsapp' className='mt-0'>
        <WhatsappMessagingScreen />
      </TabsContent>
      <TabsContent value='sms' className='mt-0'>
        <SmsMessagingScreen />
      </TabsContent>
    </Tabs>
  )
}
