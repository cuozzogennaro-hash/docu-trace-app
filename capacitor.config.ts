import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.220cd5d1565d4443b75610dfe60373cf',
  appName: 'HACCP Pro',
  webDir: 'dist',
  server: {
    url: 'https://220cd5d1-565d-4443-b756-10dfe60373cf.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
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