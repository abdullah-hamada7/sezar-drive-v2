const http = require('http');

// Configuration
const API_HOST = 'localhost';
const API_PORT = 3001;
const API_BASE = '/api/v1';

// Credentials (do not hardcode real logins in repo)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DRIVER_EMAIL = 'driver1@fleet.com';
const DRIVER_PASSWORD = 'Driver123!';
const NEW_DRIVER_PASSWORD = 'NewDriverPassword123!';

if (!ADMIN_PASSWORD) {
  console.error('Missing ADMIN_PASSWORD env var. Refusing to run.');
  process.exit(1);
}

// State
let adminToken = '';
let driverToken = '';
let driverId = '';
let verificationId = '';
let testVehicleQr = 'QR-1771101653513';

// Utils
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: API_BASE + path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            console.error(`[ERROR] Request failed with status ${res.statusCode}. Body:`, data);
            reject({ status: res.statusCode, error: parsed });
          }
        } catch {
          console.error(`[CRITICAL] JSON Parse Error on status ${res.statusCode}. Raw Data:`, data);
          reject({ status: res.statusCode, error: data });
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function log(msg, type = 'INFO') {
  console.log(`[${type}] ${msg}`);
}

async function verifyFeatures() {
  log('Starting Verification...', 'INIT');

  try {
    // 1. Login Admin
    log('Logging in Admin...', 'STEP');
    const adminLogin = await request('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    adminToken = adminLogin.accessToken;
    log('Admin Logged In', 'SUCCESS');

    // 2. Login Driver
    log('Logging in Driver (initial)...', 'STEP');
    let driverLogin;
    try {
      driverLogin = await request('POST', '/auth/login', { email: DRIVER_EMAIL, password: DRIVER_PASSWORD });
    } catch {
      log('Initial login failed, trying with new password...', 'INFO');
      driverLogin = await request('POST', '/auth/login', { email: DRIVER_EMAIL, password: NEW_DRIVER_PASSWORD });
    }

    driverToken = driverLogin.accessToken;
    driverId = driverLogin.user.id;
    log('Driver Logged In', 'SUCCESS');

    // 3. Password Change (if required)
    if (driverLogin.user.mustChangePassword) {
      log('Driver must change password. Changing now...', 'STEP');
      const changeRes = await request('POST', '/auth/change-password', {
        currentPassword: DRIVER_PASSWORD,
        newPassword: NEW_DRIVER_PASSWORD
      }, driverToken);
      // Refresh token
      driverToken = changeRes.accessToken;
      log('Password Changed Successfully', 'SUCCESS');
    }

    // 4. Admin: Check Pending Verifications
    log('Checking Pending Verifications...', 'STEP');
    const pending = await request('GET', '/auth/identity/pending', null, adminToken);

    let targetVerification = pending.find(v => v.driverId === driverId);

    if (!targetVerification) {
      log('No pending verification found. This is expected if identity verify not yet called.', 'INFO');
    } else {
      verificationId = targetVerification.id;
      log(`Found pending verification: ${verificationId}`, 'SUCCESS');

      // 5. Admin: Approve Verification
      log('Approving Verification...', 'STEP');
      await request('PUT', `/auth/identity/${verificationId}/review`, { action: 'approve' }, adminToken);
      log('Verification Approved', 'SUCCESS');
    }

    // 6. QR Matchmaking
    log(`Attempting QR Matchmaking with code '${testVehicleQr}'...`, 'STEP');
    try {
      const assignment = await request('POST', '/vehicles/scan-qr', { qrCode: testVehicleQr }, driverToken);
      log(`Vehicle Assigned: ${assignment.vehicle?.plateNumber}`, 'SUCCESS');
    } catch (e) {
      if (e.status === 400 && e.error?.error?.message?.includes('already assigned')) {
        log('Vehicle already assigned (Clean pass)', 'SUCCESS');
      } else if (e.status === 404) {
        log('Vehicle QR not found (Fail)', 'FAIL');
        throw new Error('Vehicle not found', { cause: e });
      } else {
        throw e;
      }
    }

    // 7. Stats Check (Admin)
    log('Checking Activity Stats endpoint...', 'STEP');
    const activity = await request('GET', '/stats/activity', null, adminToken);
    if (Array.isArray(activity)) {
      log('Activity Stats returned array', 'SUCCESS');
    } else {
      log('Activity Stats failed format', 'FAIL');
    }

    log('ALL VERIFICATION STEPS COMPLETED', 'DONE');

  } catch (err) {
    if (err.error) console.error('[ERROR] Response Body:', JSON.stringify(err.error, null, 2));
    console.error('[CRITICAL] Verification Failed:', err);
    process.exit(1);
  }
}

verifyFeatures();
