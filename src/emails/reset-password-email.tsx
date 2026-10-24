import { Body, Button, Container, Head, Heading, Preview, Text } from '@react-email/components'

import { emailStyles } from '~/emails/email-styles'

interface ResetPasswordEmailProps {
  url: string
  userName?: string
}

export function ResetPasswordEmail({ url, userName }: ResetPasswordEmailProps) {
  return (
    <html lang='he' dir='rtl'>
      <Head />
      <Preview>איפוס הסיסמה שלכם</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Heading style={emailStyles.heading}>איפוס הסיסמה שלכם</Heading>
          <Text style={emailStyles.bodyText}>
            {userName ? `הי ${userName}, ` : ''}הקישו על הכפתור שלהלן כדי לאפס את הסיסמה שלכם. הקישור
            בתוקף לשעה אחת.
          </Text>
          <Button
            href={url}
            style={{
              background: '#111827',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '6px',
              fontWeight: 'bold',
              display: 'inline-block',
            }}
          >
            איפוס הסיסמה
          </Button>
          <Text style={emailStyles.footerText}>
            אם לא ביקשתם את זה, אפשר להתעלם מהמייל הזה בבטחה.
          </Text>
        </Container>
      </Body>
    </html>
  )
}
