const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const trackingService = require('./tracking.service');

let wss;
const adminClients = new Map(); // userId -> ws
const driverClients = new Map(); // userId -> ws

/**
 * Initialize WebSocket server on the HTTP server.
 */
function initWebSocketServer(server) {
  wss = new WebSocket.Server({ server, path: '/ws/tracking' });

  wss.on('connection', (ws, req) => {
    // Authenticate via query param or protocol header
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    let user;
    try {
      user = jwt.verify(token, config.jwtSecret);
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    if (user.role === 'admin') {
      adminClients.set(user.id, ws);
      // Send current active positions
      trackingService.getActiveDriverPositions().then((positions) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'initial_positions', data: positions }));
        }
      });
    } else if (user.role === 'driver') {
      driverClients.set(user.id, ws);
    }

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'location_update' && user.role === 'driver') {
          await trackingService.updateLocation(user.id, data.payload, data.shiftId, data.tripId);
          // Broadcast to all admin clients
          broadcastToAdmins({
            type: 'driver_position',
            data: {
              driverId: user.id,
              driverName: user.email,
              latitude: data.payload.latitude,
              longitude: data.payload.longitude,
              speed: data.payload.speed,
              timestamp: data.payload.recordedAt || new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        console.error('WebSocket message error:', err.message);
      }
    });

    ws.on('close', () => {
      adminClients.delete(user.id);
      driverClients.delete(user.id);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error.message);
      adminClients.delete(user.id);
      driverClients.delete(user.id);
    });
  });

  console.log('WebSocket tracking server initialized on /ws/tracking');
}

function broadcastToAdmins(message) {
  const payload = JSON.stringify(message);
  for (const [, ws] of adminClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/**
 * Sends a notification to all active admin dashboards.
 */
function notifyAdmins(type, title, message, data = {}) {
  broadcastToAdmins({
    type: 'notification',
    payload: {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title,
      message,
      data,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Sends a notification to a specific driver.
 */
function notifyDriver(userId, data) {
  const ws = driverClients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

module.exports = { initWebSocketServer, notifyAdmins, notifyDriver };
