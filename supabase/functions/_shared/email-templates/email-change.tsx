/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { main, container, header, brand, card, h1, text, link, buttonWrap, button, footer, signature } from './_styles.ts'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, oldEmail, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Conferma il cambio email per {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>{siteName}</Text></Section>
        <Section style={card}>
          <Heading style={h1}>Conferma il cambio email</Heading>
          <Text style={text}>
            Hai richiesto di cambiare l'indirizzo email del tuo account {siteName} da{' '}
            <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link>{' '}a{' '}
            <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
          </Text>
          <Text style={text}>Clicca sul pulsante qui sotto per confermare il cambio:</Text>
          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>Conferma cambio email</Button>
          </Section>
          <Text style={footer}>Se non hai richiesto tu questo cambio, metti subito al sicuro il tuo account.</Text>
        </Section>
        <Text style={signature}>— Il team {siteName}</Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
