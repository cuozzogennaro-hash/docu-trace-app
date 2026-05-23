# Pubblicazione su App Store con stampa Bluetooth

## Perché serve un'app nativa

Su iOS Safari (e quindi anche nelle PWA installate da iPhone/iPad) **Web Bluetooth è disabilitato da Apple**. Nessuna app web potrà mai stampare via Bluetooth su iOS. L'unica strada è un **wrapper nativo** che incapsuli l'app web in un'app iOS reale, usando le API native del sistema per accedere al Bluetooth.

La soluzione standard per progetti Lovable è **Capacitor** (di Ionic): mantiene tutto il codice React attuale e lo impacchetta come app iOS/Android.

## Cosa farò nel progetto Lovable

1. **Installare Capacitor** e i pacchetti iOS/Android:
   - `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`
2. **Creare `capacitor.config.ts`** con:
   - appId: `app.lovable.220cd5d1565d4443b75610dfe60373cf`
   - appName: `HACCP Pro`
   - hot-reload dal sandbox Lovable per testare in tempo reale su dispositivo
3. **Installare un plugin Bluetooth per stampanti termiche**, a scelta tra:
   - `@capacitor-community/bluetooth-le` (BLE generico, va bene per stampanti BLE moderne)
   - `capacitor-thermal-printer` o equivalente (specifico per ESC/POS, formato standard delle stampanti scontrino)
4. **Aggiungere una funzione "Stampa su Bluetooth"** nei punti che oggi usano `window.print()` (etichette in `PrintLabelDialog.tsx`, menu allergeni, ecc.): rilevamento dispositivo nativo, scansione stampanti, invio comandi ESC/POS per testo + grassetto allergeni.
   - Su web/PWA il pulsante mantiene il comportamento attuale (`window.print`).
   - Su iOS/Android nativo appare il flusso "scegli stampante Bluetooth".
5. **Aggiornare `Info.plist`** (lato Xcode, vedi sotto) con i permessi `NSBluetoothAlwaysUsageDescription`.

## Cosa dovrai fare tu (fuori da Lovable)

La build iOS **non può essere fatta dentro Lovable** — serve un Mac con Xcode e un account Apple Developer.

1. **Account Apple Developer** — 99 USD/anno: https://developer.apple.com/programs/
2. **Esportare il progetto su GitHub** dal pulsante in alto a destra in Lovable, poi `git clone` sul tuo Mac.
3. Sul Mac:
   ```
   npm install
   npx cap add ios
   npm run build
   npx cap sync
   npx cap open ios
   ```
4. In Xcode: firmare l'app col tuo Apple Developer Team, testare su iPhone reale, poi **Archive → Distribute → App Store Connect**.
5. Compilare la scheda App Store (icona, screenshot, descrizione, privacy policy — **obbligatoria** per app con login).
6. Inviare in **review Apple** (di solito 24–72 h).

## Tempi e costi realistici

- Lavoro mio in Lovable (Capacitor + plugin Bluetooth + UI stampa): un paio di iterazioni.
- Account Apple Developer: 99 USD/anno.
- Mac con Xcode obbligatorio per build/upload (non aggirabile).
- Prima review Apple: 1–3 giorni; possibili richieste di modifica.

## Bonus: anche Android

Con lo stesso codice puoi pubblicare anche su **Google Play** (`npx cap add android`, Android Studio, account dev Google 25 USD una tantum). Su Android Web Bluetooth funzionerebbe pure via PWA, ma l'app nativa è più affidabile.

## Domande prima di partire

- Vuoi **solo iOS** o **iOS + Android**?
- Sai già il **modello di stampante Bluetooth** che useranno i clienti? (Serve per scegliere il plugin giusto — BLE generico vs ESC/POS termico.)
- Hai già **account Apple Developer** o devo guidarti nell'iscrizione?
