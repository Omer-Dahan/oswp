import { Body, Container, Head, Heading, Preview, Section, Text } from '@react-email/components'

import { emailStyles } from '~/emails/email-styles'

interface OtpEmailProps {
  otp: string
  type: 'sign-in' | 'email-verification' | 'forget-password'
}

const subjectMap = {
  'sign-in': 'קוד הכניסה שלכם',
  'email-verification': 'אימות כתובת האימייל שלכם',
  'forget-password': 'איפוס הסיסמה שלכם',
}

export function OtpEmail({ otp, type }: OtpEmailProps) {
  const subject = subjectMap[type]

  return (
    <html lang='en'>
      <Head />
      <Preview>
        {subject}: {otp}
      </Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Heading style={emailStyles.heading}>{subject}</Heading>
          <Text style={emailStyles.bodyText}>
            השתמשו בקוד שלהלן כדי להמשיך. הוא בתוקף ל-10 דקות.
          </Text>
          <Section
            style={{
              background: '#f3f4f6',
              borderRadius: '8px',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <Text
              style={{
                fontSize: '36px',
                fontWeight: 'bold',
                letterSpacing: '8px',
                color: '#111827',
                margin: '0',
              }}
            >
              {otp}
            </Text>
          </Section>
          <Text style={emailStyles.footerText}>
            אם לא ביקשתם את זה, אפשר להתעלם מהמייל הזה בבטחה.
          </Text>
        </Container>
      </Body>
    </html>
  )
}
