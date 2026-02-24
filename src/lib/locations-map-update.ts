/**
 * Notify the map (and other tabs) that location coordinates have changed
 * so it can refetch and update pins immediately.
 */
const EVENT_NAME = 'locations-map-update';
const CHANNEL_NAME = 'locations-map';

export function notifyLocationsMapUpdate(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
  try {
    new BroadcastChannel(CHANNEL_NAME).postMessage('update');
  } catch {
    // BroadcastChannel not supported
  }
}

export function subscribeToLocationsMapUpdate(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onEvent = () => callback();
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener('message', onEvent);
  window.addEventListener(EVENT_NAME, onEvent);
  return () => {
    channel.removeEventListener('message', onEvent);
    channel.close();
    window.removeEventListener(EVENT_NAME, onEvent);
  };
}
