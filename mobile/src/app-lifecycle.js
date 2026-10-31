import { App } from '@capacitor/app';

export async function registerAppLifecycle({ onResume = () => {}, onPause = () => {},
  onBackButton = () => {} } = {}) {
  const handles = [];
  if (typeof onResume === 'function') {
    handles.push(await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) onResume();
      else onPause();
    }));
  }
  if (typeof onBackButton === 'function') {
    handles.push(await App.addListener('backButton', event => onBackButton(event)));
  }
  return async () => {
    await Promise.all(handles.map(handle => handle.remove()));
  };
}
