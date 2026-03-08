/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your new email for BURS</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Text style={logoText}>BURS</Text>
        </Section>
        <Heading style={h1}>Confirm email change</Heading>
        <Text style={text}>
          You requested to change your email from{' '}
          <Link href={`mailto:${email}`} style={link}>{email}</Link>
          {' '}to{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirm Change
        </Button>
        <Text style={footer}>
          Didn't request this? Please secure your account immediately.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Sora', 'Inter', 'Helvetica Neue', Arial, sans-serif",
}
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { marginBottom: '32px' }
const logoText = {
  fontSize: '28px',
  fontWeight: '700' as const,
  color: '#111111',
  letterSpacing: '4px',
  margin: '0',
}
const h1 = {
  fontSize: '24px',
  fontWeight: '600' as const,
  color: '#111111',
  margin: '0 0 16px',
  lineHeight: '1.3',
}
const text = {
  fontSize: '15px',
  color: '#6B6B6B',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const link = { color: '#111111', textDecoration: 'underline' }
const button = {
  backgroundColor: '#111111',
  color: '#F6F4F1',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const footer = {
  fontSize: '12px',
  color: '#AAAAAA',
  margin: '40px 0 0',
  lineHeight: '1.5',
}
