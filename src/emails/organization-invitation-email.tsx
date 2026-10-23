import { Body, Button, Container, Head, Heading, Preview, Text } from '@react-email/components'

import { emailStyles } from '~/emails/email-styles'

interface OrganizationInvitationEmailProps {
  inviteUrl: string
  invitedByName?: string
  organizationName: string
  memberRole: string
}

export function OrganizationInvitationEmail({
  inviteUrl,
  invitedByName,
  organizationName,
  memberRole,
}: OrganizationInvitationEmailProps) {
  const inviterLead = invitedByName
    ? `${invitedByName} הזמינו אתכם לשתף פעולה ב${organizationName}.`
    : `הוזמנתם לשתף פעולה ב${organizationName}.`

  return (
    <html lang='en'>
      <Head />
      <Preview>הצטרפו ל{organizationName} ב-OSWP</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Heading style={emailStyles.heading}>הצטרפו לסביבת העבודה של החתונה</Heading>
          <Text style={emailStyles.bodyText}>{inviterLead}</Text>
          <Text style={emailStyles.bodyText}>
            הוקצה לכם תפקיד <strong>{memberRole}</strong>. אשרו את ההזמנה כדי לגשת לכלי התכנון,
            האורחים והאתר של החתונה הזו.
          </Text>
          <Button
            href={inviteUrl}
            style={{
              background: '#111827',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '6px',
              fontWeight: 'bold',
              display: 'inline-block',
            }}
          >
            אישור ההזמנה
          </Button>
          <Text style={emailStyles.footerText}>
            אם לא ציפיתם להזמנה הזו, אפשר להתעלם מהמייל הזה בבטחה.
          </Text>
        </Container>
      </Body>
    </html>
  )
}
