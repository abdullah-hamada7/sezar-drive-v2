/**
 * markTabViewed(tabName)
 *
 * Call this on mount in any driver tab page.
 * It tells the backend "driver just opened this tab → stamp viewedAt = now()"
 * so the badge count for that tab drops to 0 and only future items will show a badge.
 *
 * Fires ws:update to trigger useDriverBadges to re-fetch immediately.
 */
import { http } from './http.service';

export function markTabViewed(tabName) {
  http.request(`/drivers/tabs/${tabName}/mark-viewed`, { method: 'PATCH' })
    .then(() => window.dispatchEvent(new Event('ws:update')))
    .catch(() => {}); // non-critical — badge will clear on next 30-second poll
}
