import { Capacitor } from '@capacitor/core';

export const platform = Object.freeze({
  isNative: () => Capacitor.isNativePlatform(),
  getName: () => Capacitor.getPlatform(),
  isAndroid: () => Capacitor.getPlatform() === 'android',
  isIOS: () => Capacitor.getPlatform() === 'ios',
  isWeb: () => Capacitor.getPlatform() === 'web'
});
