import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.220cd5d1565d4443b75610dfe60373cf',
  appName: 'HACCP Trace',
  webDir: 'dist',
  // NOTE: do NOT add a `server.url` block here for the Play Store / App Store build.
  // Loading remote content at runtime is forbidden by Google Play policy and will
  // get the app rejected. For local hot-reload during development, temporarily
  // re-add a `server` block locally — but never commit it for a release build.
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    BluetoothLe: {
      displayStrings: {
        scanning: 'Ricerca stampanti…',
        cancel: 'Annulla',
        availableDevices: 'Stampanti disponibili',
        noDeviceFound: 'Nessuna stampante trovata',
      },
    },
  },
};

export default config;