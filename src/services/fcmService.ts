import { app } from '../lib/firebase';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Browser notifications not supported in this environment.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const messagingSupported = await isSupported();
      if (messagingSupported) {
        const messaging = getMessaging(app);
        try {
          const token = await getToken(messaging, {
            vapidKey: 'BPaT8m9a7v1_xL20J_0q-mock_vapid_key_hostel'
          });
          if (token) {
            console.log('FCM Registration Token:', token);
            localStorage.setItem('ira_fcm_token', token);
            return token;
          }
        } catch (tokenErr) {
          console.warn('FCM token acquisition note (using standard Web Push API fallback):', tokenErr);
        }
      }
      return 'granted_web_push';
    }
  } catch (err) {
    console.warn('Failed to request notification permissions:', err);
  }
  return null;
}

export function registerForegroundMessageHandler(onNotificationReceived: (payload: any) => void) {
  isSupported().then((supported) => {
    if (!supported) return;
    try {
      const messaging = getMessaging(app);
      onMessage(messaging, (payload) => {
        console.log('Foreground FCM notification received:', payload);
        onNotificationReceived(payload);
      });
    } catch (err) {
      console.warn('Foreground FCM listener note:', err);
    }
  });
}

export function sendLocalPushNotification(
  title: string, 
  body: string, 
  category: string = 'General', 
  noticeId?: string
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            body: body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: noticeId || `notice_${Date.now()}`,
            data: { noticeId, category }
          });
        });
      } else {
        new Notification(title, {
          body: body,
          icon: '/favicon.ico',
          tag: noticeId || `notice_${Date.now()}`
        });
      }
    } catch (e) {
      console.warn('Browser notification trigger note:', e);
    }
  }
}
