/**
 * usePushPermission – requests browser Notification API permission once
 * and provides a helper to show native OS notifications for driver events.
 *
 * Usage:
 *   usePushPermission();                     // call once in DriverLayout
 *   showNativeNotification('Title', 'Body'); // call anywhere
 */
import { useEffect } from 'react';

let permissionState = typeof Notification !== 'undefined' ? Notification.permission : 'denied';

/**
 * Request permission on mount (driver only).
 */
export function usePushPermission() {
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((result) => {
        permissionState = result;
      });
    } else {
      permissionState = Notification.permission;
    }
  }, []);
}

/**
 * Show a native browser notification if permission was granted.
 * Falls back silently if denied or unavailable.
 */
export function showNativeNotification(title, body) {
  if (typeof Notification === 'undefined') return;
  if (permissionState !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `sezar-${Date.now()}`,
    });
  } catch {
    // Notification constructor may throw on some mobile browsers; ignore.
  }
}
