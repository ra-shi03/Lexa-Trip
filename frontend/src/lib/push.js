import { api } from './api';

/**
 * Browser push (Firebase Cloud Messaging). Public web config comes from frontend/.env (VITE_FIREBASE_*);
 * the notification itself is drawn by public/sw.js. Needs https (or localhost).
 */
const env = import.meta.env;
const CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
const VAPID = env.VITE_FIREBASE_VAPID_KEY;
const BASE = { user: '/me', vendor: '/vendor', admin: '/admin' };
export const pushKey = (role) => `lt_push_${role}`; // token registered for this audience on this browser

export const pushSupported = () => Boolean(CONFIG.apiKey && CONFIG.appId && VAPID) && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushEnabled = (role) => pushSupported() && Notification.permission === 'granted' && Boolean(localStorage.getItem(pushKey(role)));

async function deviceToken() {
  // Firebase is only downloaded when push is actually used
  const [{ initializeApp, getApps }, { getMessaging, getToken }] = await Promise.all([import('firebase/app'), import('firebase/messaging')]);
  const app = getApps()[0] || initializeApp(CONFIG);
  // "?dev" tells the service worker to skip caching while developing
  await navigator.serviceWorker.register(env.PROD ? '/sw.js' : '/sw.js?dev');
  const registration = await navigator.serviceWorker.ready;
  return getToken(getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: registration });
}

async function register(role) {
  const token = await deviceToken();
  if (!token) throw new Error('This browser did not give a push token');
  await api.post(`${BASE[role]}/push-token`, { token, platform: 'web' });
  localStorage.setItem(pushKey(role), token);
}

/** Must be called from a click: browsers only show the permission prompt for a user action */
export async function enablePush(role) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser’s site settings.');
  await register(role);
}

export async function disablePush(role) {
  const token = localStorage.getItem(pushKey(role));
  if (token) await api.del(`${BASE[role]}/push-token`, { data: { token } });
  localStorage.removeItem(pushKey(role));
}

/** On app start for a signed-in account that turned push on: tokens can rotate, so register again */
export function syncPush(role) {
  if (pushEnabled(role)) register(role).catch(() => {});
}
