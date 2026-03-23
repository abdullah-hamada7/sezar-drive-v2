import i18n from '../i18n';
import { offlineQueue } from './offline-queue.service';

function emitToast(message, type = 'info', code = null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type, code } }));
}

/**
 * Standardized helper for manual offlineQueue.enqueue usage.
 * Keeps UX consistent with HttpService's offline write queue behavior.
 */
export async function enqueueOfflineRequest(request, options = {}) {
  const entry = await offlineQueue.enqueue(request);

  const toastKey = options.toastKey || 'common.offline.saved_will_sync';
  emitToast(i18n.t(toastKey), options.toastType || 'info', options.toastCode || 'QUEUED_OFFLINE');

  return entry;
}
