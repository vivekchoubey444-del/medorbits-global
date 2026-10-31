import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.medorbits.app',
  appName: 'MedOrbits',
  webDir: 'www',
  bundledWebRuntime: false,
  loggingBehavior: 'none',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#162d25',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#162d25'
    }
  }
};

export default config;
