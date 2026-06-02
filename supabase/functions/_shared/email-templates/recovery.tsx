/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { main, container, header, brand, card, h1, text, buttonWrap, button, footer, signature } from './_styles.ts'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Reimposta la tua password per {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>{siteName}</Text></Section>
        <Section style={card}>
          <Heading style={h1}>Reimposta la tua password</Heading>
          <Text style={text}>
            Abbiamo ricevuto una richiesta di reimpostazione password per il tuo account {siteName}. Clicca sul pulsante qui sotto per scegliere una nuova password.
          </Text>
          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>Reimposta password</Button>
          </Section>
          <Text style={footer}>
            Se non hai richiesto la reimpostazione, puoi ignorare questa email. La tua password resterà invariata.
          </Text>
        </Section>
        <Text style={signature}>— Il team {siteName}</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
