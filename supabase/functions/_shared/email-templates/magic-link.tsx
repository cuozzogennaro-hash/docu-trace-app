/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { main, container, header, brand, card, h1, text, buttonWrap, button, footer, signature } from './_styles.ts'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Il tuo link di accesso per {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>{siteName}</Text></Section>
        <Section style={card}>
          <Heading style={h1}>Il tuo link di accesso</Heading>
          <Text style={text}>
            Clicca sul pulsante qui sotto per accedere a {siteName}. Questo link scadrà a breve.
          </Text>
          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>Accedi</Button>
          </Section>
          <Text style={footer}>Se non hai richiesto questo link, puoi ignorare questa email.</Text>
        </Section>
        <Text style={signature}>— Il team {siteName}</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
