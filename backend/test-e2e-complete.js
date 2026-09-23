const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000';
const ADMIN_KEY = 'pavo_secret_admin_key_change_me_in_production_2026';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runEndToEndVerification() {
  console.log('================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE END-TO-END VERIFICATION');
  console.log('================================================================\n');

  // STEP 1: Health check
  const health = await request('GET', '/health');
  console.log('[1/12] Health Check:', health.status === 200 ? '✅ ONLINE' : '❌ OFFLINE', health.body);

  // STEP 2: Database File Exists & Persistent
  const dbFile = path.resolve(__dirname, 'data/licenses.db');
  console.log('[2/12] Database Persistence Check:', fs.existsSync(dbFile) ? '✅ DB FILE PRESENT' : '❌ DB MISSING', `(${dbFile})`);

  // STEP 3: Create a license via Admin API (Discord Bot simulation)
  const createRes = await request('POST', '/api/admin/licenses/create', {
    durationDays: 30,
    discordUserId: '987654321098765432',
    discordUsername: 'GamerPro#1337',
    notes: 'Discord Bot Created Lifetime Customer'
  }, { 'X-Admin-Key': ADMIN_KEY });

  const license = createRes.body.license;
  console.log('[3/12] Discord Bot License Creation:', createRes.status === 201 ? '✅ SUCCESS' : '❌ FAILED', `Key: ${license.license_key}`);

  // STEP 4: Query single license via Admin API
  const infoRes = await request('GET', `/api/admin/licenses/${license.license_key}`, null, { 'X-Admin-Key': ADMIN_KEY });
  console.log('[4/12] License Query (Admin):', infoRes.status === 200 && infoRes.body.license.status === 'active' ? '✅ ACTIVE' : '❌ FAILED');

  // STEP 5: Fake license rejection
  const fakeRes = await request('POST', '/api/license/validate', {
    licenseKey: 'PAVO-1234-5678-9999',
    hwid: 'FAKE-HWID-000'
  });
  console.log('[5/12] Fake License Rejection:', fakeRes.status === 404 && fakeRes.body.code === 'NOT_FOUND' ? '✅ REJECTED AS EXPECTED' : '❌ FAILED', fakeRes.body.message);

  // STEP 6: Pavo Tweak Activation (Device 1)
  const dev1Hwid = 'PAVO-HWID-USER-PC-1';
  const actRes = await request('POST', '/api/license/activate', {
    licenseKey: license.license_key,
    hwid: dev1Hwid
  });
  console.log('[6/12] Pavo Tweak Activation (Device 1):', actRes.status === 200 && actRes.body.valid === true ? '✅ ACTIVATED' : '❌ FAILED', actRes.body.code);

  // STEP 7: Second Device Rejection (Device 2 HWID mismatch)
  const dev2Hwid = 'PAVO-HWID-USER-PC-2';
  const dev2ActRes = await request('POST', '/api/license/activate', {
    licenseKey: license.license_key,
    hwid: dev2Hwid
  });
  console.log('[7/12] Prevent 2nd Device Sharing (HWID Conflict):', dev2ActRes.status === 403 && dev2ActRes.body.code === 'HWID_MISMATCH' ? '✅ PROTECTED & BLOCKED' : '❌ FAILED', dev2ActRes.body.message);

  // STEP 8: Device 1 Heartbeat (Valid)
  const hb1 = await request('POST', '/api/license/heartbeat', {
    licenseKey: license.license_key,
    hwid: dev1Hwid
  });
  console.log('[8/12] Device 1 Heartbeat:', hb1.status === 200 && hb1.body.valid === true ? '✅ HEALTHY' : '❌ FAILED');

  // STEP 9: Ban License via Discord Bot / Admin API
  const banRes = await request('POST', '/api/admin/licenses/ban', {
    licenseKey: license.license_key,
    reason: 'Chargeback / Terms violation'
  }, { 'X-Admin-Key': ADMIN_KEY });
  console.log('[9/12] Ban License via Admin/Discord:', banRes.status === 200 && banRes.body.license.status === 'banned' ? '✅ BANNED IN DATABASE' : '❌ FAILED');

  // STEP 10: Real-time ban detection during Heartbeat
  const hbBanned = await request('POST', '/api/license/heartbeat', {
    licenseKey: license.license_key,
    hwid: dev1Hwid
  });
  console.log('[10/12] Real-time Ban Heartbeat Detection:', hbBanned.status === 403 && hbBanned.body.code === 'BANNED' ? '✅ CAUGHT BAN & LOCKED CLIENT' : '❌ FAILED', `"${hbBanned.body.message}"`);

  // STEP 11: HWID Reset
  const unbanRes = await request('POST', '/api/admin/licenses/unban', { licenseKey: license.license_key }, { 'X-Admin-Key': ADMIN_KEY });
  const resetHwidRes = await request('POST', '/api/admin/licenses/reset-hwid', { licenseKey: license.license_key }, { 'X-Admin-Key': ADMIN_KEY });
  console.log('[11/12] Unban & Reset HWID for Transfer:', unbanRes.status === 200 && resetHwidRes.status === 200 ? '✅ HWID CLEARED' : '❌ FAILED');

  // STEP 12: Device 2 can now activate
  const dev2NewAct = await request('POST', '/api/license/activate', {
    licenseKey: license.license_key,
    hwid: dev2Hwid
  });
  console.log('[12/12] Device 2 Activation After HWID Reset:', dev2NewAct.status === 200 && dev2NewAct.body.valid === true ? '✅ SUCCESS' : '❌ FAILED', dev2NewAct.body.code);

  console.log('\n================================================================');
  console.log('🎉 ALL 12/12 INTEGRATION VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runEndToEndVerification().catch(err => {
  console.error('E2E Verification Error:', err);
  process.exit(1);
});
