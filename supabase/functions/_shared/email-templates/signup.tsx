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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to BURS — confirm your email to get started</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Text style={logoText}>BURS</Text>
        </Section>
        <Heading style={h1}>Welcome aboard</Heading>
        <Text style={text}>
          You're one step away from your personal AI wardrobe.
          Confirm your email to start building outfits, planning looks,
          and getting smart styling advice.
        </Text>
        <Text style={textSmall}>
          Confirming for{' '}
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
        </Text>
        <Button style={button} href={confirmationUrl}>
          Get Started
        </Button>
        <Text style={footer}>
          Didn't sign up for BURS? You can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Sora', 'Inter', 'Helvetica Neue', Arial, sans-serif",
}
const container = {
  padding: '40px 32px',
  maxWidth: '480px',
  margin: '0 auto',
}
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
const textSmall = {
  fontSize: '13px',
  color: '#999999',
  lineHeight: '1.5',
  margin: '0 0 28px',
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
