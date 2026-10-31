import { Network } from '@capacitor/network';

export async function getNetworkStatus() {
  return Network.getStatus();
}

export async function watchNetwork(callback) {
  if (typeof callback !== 'function') throw new TypeError('callback must be a function');
  return Network.addListener('networkStatusChange', callback);
}
