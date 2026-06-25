const wsBroadcast = require('./wsBroadcast.service');
const pushService = require('./push.service');
const notificationService = require('./notification.service');

/**
 * Converts payload values to strings for FCM data fields.
 */
function toFcmData(data) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value === null || value === undefined) continue;
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return out;
}

/**
 * Unified driver alerting: WebSocket + in-app notification record + push (FCM + PWA).
 *
 * @param {string} driverId
 * @param {object} options
 * @param {string} options.type - Event type (e.g. trip_assigned)
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {string|null} [options.entityId] - Related entity id
 * @param {object} [options.wsPayload] - Extra WebSocket payload fields
 * @param {boolean} [options.persist=true] - Save to notifications table
 * @param {boolean} [options.push=true] - Send FCM / web-push
 */
async function alertDriver(driverId, {
  type,
  title,
  body,
  entityId = null,
  wsPayload = {},
  persist = true,
  push = true,
}) {
  if (!driverId || !type) return;

  wsBroadcast.notifyDriver(driverId, {
    type,
    entityId,
    ...wsPayload,
  });

  const tasks = [];

  if (persist) {
    tasks.push(
      notificationService
        .createNotification(driverId, { title, body, type, entityId })
        .catch((err) =>
          console.error(`[DriverAlert] Failed to persist ${type}:`, err.message),
        ),
    );
  }

  if (push) {
    tasks.push(
      pushService
        .sendNotificationToUser(driverId, {
          title,
          body,
          tag: entityId ? `${type}_${entityId}` : type,
          data: toFcmData({ type, entityId, ...wsPayload }),
        })
        .catch((err) =>
          console.error(`[DriverAlert] Failed to push ${type}:`, err.message),
        ),
    );
  }

  await Promise.all(tasks);
}

/**
 * WebSocket-only update (no push / in-app record). Used for driver-initiated
 * events where the UI is already on-screen (e.g. expense submitted).
 */
function notifyDriverWs(driverId, payload) {
  if (!driverId) return;
  wsBroadcast.notifyDriver(driverId, payload);
}

module.exports = { alertDriver, notifyDriverWs, notifyAdmins: wsBroadcast.notifyAdmins };
