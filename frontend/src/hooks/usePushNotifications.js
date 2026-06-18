import { useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { http } from '../services/http.service';

// Helper to convert base64 VAPID key to Uint8Array for pushManager
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { isAuthenticated, user } = useAuth();

  const subscribeUser = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported on this browser/device');
      return;
    }

    try {
      // 1. Get Service Worker registration
      const registration = await navigator.serviceWorker.ready;

      // 2. Fetch VAPID Public Key from backend
      const res = await http.request('/push/vapid-key');
      const vapidPublicKey = res.data?.publicKey;

      if (!vapidPublicKey) {
        console.error('VAPID public key not found');
        return;
      }

      // 3. Request browser notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return;
      }

      // 4. Check if subscription already exists
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // 5. Subscribe user
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }

      // 6. Save subscription on backend database
      await http.request('/push/subscribe', {
        method: 'POST',
        body: { subscription },
      });

      console.log('PWA Push Notification registered successfully');
    } catch (err) {
      console.error('Failed to subscribe user to Push Notifications:', err);
    }
  }, []);

  useEffect(() => {
    // Only register push subscription if driver is authenticated
    if (isAuthenticated && user?.role === 'driver') {
      // Delay slightly to let page loading stabilize
      const timer = setTimeout(() => {
        subscribeUser();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user?.role, subscribeUser]);
}
