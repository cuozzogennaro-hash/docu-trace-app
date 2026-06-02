/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { main, container, header, brand, card, h1, text, link, buttonWrap, button, footer, signature } from './_styles.ts'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Sei stato invitato a unirti a {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>{siteName}</Text></Section>
        <Section style={card}>
          <Heading style={h1}>Sei stato invitato</Heading>
          <Text style={text}>
            Sei stato invitato a unirti a{' '}
            <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>. Clicca sul pulsante qui sotto per accettare l'invito e creare il tuo account.
          </Text>
          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>Accetta l'invito</Button>
          </Section>
          <Text style={footer}>Se non ti aspettavi questo invito, puoi ignorare questa email.</Text>
        </Section>
        <Text style={signature}>— Il team {siteName}</Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
