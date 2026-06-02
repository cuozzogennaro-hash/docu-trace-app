/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { main, container, header, brand, card, h1, text, codeStyle, footer, signature } from './_styles.ts'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Il tuo codice di verifica HACCP Trace</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>HACCP Trace</Text></Section>
        <Section style={card}>
          <Heading style={h1}>Conferma la tua identità</Heading>
          <Text style={text}>Inserisci il codice qui sotto per confermare la tua identità:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footer}>Il codice scadrà a breve. Se non hai richiesto tu questa verifica, puoi ignorare questa email.</Text>
        </Section>
        <Text style={signature}>— Il team HACCP Trace</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
