const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const trackingService = require('./tracking.service');
const wsBroadcast = require('../../services/wsBroadcast.service');

let wss;
const adminClients = new Map();
const driverClients = new Map();

function extractWsToken(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const queryToken = url.searchParams.get('token');
  if (queryToken) return queryToken;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const protocols = req.headers['sec-websocket-protocol'];
  if (protocols) {
    const parts = protocols.split(',').map((part) => part.trim());
    const bearerIndex = parts.indexOf('bearer');
    if (bearerIndex >= 0 && parts[bearerIndex + 1]) {
      return parts[bearerIndex + 1];
    }
  }

  return null;
}

function deliverToAdmins(message) {
  const payload = JSON.stringify(message);
  for (const [, ws] of adminClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function deliverToDriver(userId, data) {
  const ws = driverClients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

function initWebSocketServer(server) {
  wss = new WebSocket.Server({
    server,
    path: '/ws/tracking',
    handleProtocols(protocols, req) {
      const list = protocols.split(',').map((part) => part.trim());
      if (list.includes('bearer') && extractWsToken(req)) {
        return 'bearer';
      }
      if (extractWsToken(req)) {
        return list[0] || false;
      }
      return false;
    },
  });

  wsBroadcast.registerLocalDelivery({ deliverToAdmins, deliverToDriver });

  const HEARTBEAT_INTERVAL_MS = 30_000;
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    const token = extractWsToken(req);
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
      trackingService.getActiveDriverPositions().then((positions) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'initial_positions', data: positions }));
        }
      });
    } else if (user.role === 'driver') {
      driverClients.set(user.id, ws);
    } else {
      ws.close(4003, 'Unsupported role');
      return;
    }

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'location_update' && user.role === 'driver') {
          await trackingService.updateLocation(user.id, data.payload, data.shiftId, data.tripId);
          wsBroadcast.broadcastToAdmins({
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

module.exports = { initWebSocketServer };
