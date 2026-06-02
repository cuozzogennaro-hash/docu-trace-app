/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { main, container, header, brand, card, h1, text, link, buttonWrap, button, footer, signature } from './_styles.ts'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Conferma la tua email per {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>{siteName}</Text></Section>
        <Section style={card}>
          <Heading style={h1}>Conferma la tua email</Heading>
          <Text style={text}>
            Grazie per esserti registrato su{' '}
            <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>.
          </Text>
          <Text style={text}>
            Conferma il tuo indirizzo (<Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>) cliccando sul pulsante qui sotto:
          </Text>
          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>Conferma email</Button>
          </Section>
          <Text style={footer}>Se non hai creato tu un account, puoi ignorare questa email.</Text>
        </Section>
        <Text style={signature}>— Il team {siteName}</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
