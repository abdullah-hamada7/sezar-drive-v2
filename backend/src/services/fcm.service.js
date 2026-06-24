const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const prisma = require('../config/database');
const config = require('../config');

let initialized = false;

function initFcm() {
  if (initialized) return true;

  const jsonStr = config.firebase.serviceAccountJson;
  const jsonPath = config.firebase.serviceAccountPath;

  if (!jsonStr && !jsonPath) {
    return false;
  }

  try {
    let serviceAccount;
    if (jsonStr) {
      serviceAccount = JSON.parse(jsonStr);
    } else {
      const resolved = path.isAbsolute(jsonPath)
        ? jsonPath
        : path.join(process.cwd(), jsonPath);
      serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    }

    const credential = admin.credential.cert(serviceAccount);

    if (!admin.apps.length) {
      admin.initializeApp({ credential });
    }
    initialized = true;
    return true;
  } catch (err) {
    console.error('[FCM] Failed to initialize firebase-admin:', err.message);
    return false;
  }
}

class FcmService {
  isEnabled() {
    return initFcm();
  }

  async saveToken(userId, token, platform) {
    if (!token || typeof token !== 'string') {
      throw new Error('FCM token is required');
    }
    const normalizedPlatform = String(platform || 'android').toLowerCase();
    return prisma.devicePushToken.upsert({
      where: { token },
      update: { userId, platform: normalizedPlatform },
      create: { userId, token, platform: normalizedPlatform },
    });
  }

  async removeToken(token) {
    if (!token) return false;
    try {
      await prisma.devicePushToken.delete({ where: { token } });
      return true;
    } catch (err) {
      if (err.code === 'P2025') return false;
      throw err;
    }
  }

  async sendToUser(userId, payload = {}) {
    if (!initFcm()) {
      return { success: 0, failure: 0, total: 0, skipped: true };
    }

    const tokens = await prisma.devicePushToken.findMany({
      where: { userId },
      select: { token: true },
    });

    if (tokens.length === 0) {
      return { success: 0, failure: 0, total: 0 };
    }

    const tokenList = tokens.map((t) => t.token);
    const message = buildMulticastMessage(tokenList, payload);

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      await purgeStaleTokens(tokenList, response.responses);
      return {
        success: response.successCount,
        failure: response.failureCount,
        total: tokenList.length,
      };
    } catch (err) {
      console.error('[FCM] sendToUser error:', err.message);
      return { success: 0, failure: tokenList.length, total: tokenList.length, error: err.message };
    }
  }
}

function buildMulticastMessage(tokenList, payload) {
  const { title, body, tag, data: payloadData } = payload;
  return {
    tokens: tokenList,
    notification: title ? { title, body: body || '' } : undefined,
    data: {
      ...(payloadData || {}),
      ...(tag ? { tag: String(tag) } : {}),
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'sezar_driver_events',
        sound: 'default',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  };
}

async function purgeStaleTokens(tokenList, responses) {
  const staleTokens = [];
  responses.forEach((res, idx) => {
    if (res.success) return;
    const code = res.error?.code;
    if (
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/registration-token-not-registered'
    ) {
      staleTokens.push(tokenList[idx]);
    }
  });

  if (staleTokens.length === 0) return;
  await prisma.devicePushToken.deleteMany({
    where: { token: { in: staleTokens } },
  });
}

module.exports = new FcmService();
