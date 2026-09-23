const http = require('http');

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

async function runTests() {
  console.log('--- STARTING BACKEND SUITE TESTS ---');

  // 1. Health check
  const health = await request('GET', '/health');
  console.log('1. Health Check:', health.status === 200 && health.body.status === 'online' ? '✅ PASS' : '❌ FAIL', health.body);

  // 2. Reject fake key
  const fakeCheck = await request('POST', '/api/license/validate', {
    licenseKey: 'PAVO-1234-5678-9999',
    hwid: 'TEST-HWID-001'
  });
  console.log('2. Fake License Rejection:', fakeCheck.status === 404 && fakeCheck.body.code === 'NOT_FOUND' ? '✅ PASS' : '❌ FAIL', fakeCheck.body);

  // 3. Admin create license
  const createRes = await request('POST', '/api/admin/licenses/create', {
    durationDays: 30,
    discordUserId: '123456789012345678',
    discordUsername: 'TestUser#0001',
    notes: 'Beta Tester Key'
  }, { 'X-Admin-Key': ADMIN_KEY });
  console.log('3. Create License (Admin):', createRes.status === 201 ? '✅ PASS' : '❌ FAIL', createRes.body.license ? createRes.body.license.license_key : createRes.body);

  const key = createRes.body.license.license_key;

  // 4. Activate key on Device A
  const actRes = await request('POST', '/api/license/activate', {
    licenseKey: key,
    hwid: 'DEVICE-HWID-ALPHA-123'
  });
  console.log('4. Activate on Device A:', actRes.status === 200 && actRes.body.valid === true ? '✅ PASS' : '❌ FAIL', actRes.body.code);

  // 5. Try activating on Device B (HWID conflict test)
  const conflictRes = await request('POST', '/api/license/activate', {
    licenseKey: key,
    hwid: 'DEVICE-HWID-BETA-999'
  });
  console.log('5. Reject Device B HWID Conflict:', conflictRes.status === 403 && conflictRes.body.code === 'HWID_MISMATCH' ? '✅ PASS' : '❌ FAIL', conflictRes.body.message);

  // 6. Heartbeat from Device A
  const hbRes = await request('POST', '/api/license/heartbeat', {
    licenseKey: key,
    hwid: 'DEVICE-HWID-ALPHA-123'
  });
  console.log('6. Heartbeat on Device A:', hbRes.status === 200 && hbRes.body.valid === true ? '✅ PASS' : '❌ FAIL', hbRes.body.code);

  // 7. Ban License via Admin API
  const banRes = await request('POST', '/api/admin/licenses/ban', {
    licenseKey: key,
    reason: 'Fraudulent activity detected'
  }, { 'X-Admin-Key': ADMIN_KEY });
  console.log('7. Ban License (Admin):', banRes.status === 200 && banRes.body.license.status === 'banned' ? '✅ PASS' : '❌ FAIL');

  // 8. Device A Heartbeat detects BANNED immediately
  const bannedHb = await request('POST', '/api/license/heartbeat', {
    licenseKey: key,
    hwid: 'DEVICE-HWID-ALPHA-123'
  });
  console.log('8. Heartbeat Detects BANNED:', bannedHb.status === 403 && bannedHb.body.code === 'BANNED' ? '✅ PASS' : '❌ FAIL', bannedHb.body.message);

  // 9. Unban License
  const unbanRes = await request('POST', '/api/admin/licenses/unban', {
    licenseKey: key
  }, { 'X-Admin-Key': ADMIN_KEY });
  console.log('9. Unban License (Admin):', unbanRes.status === 200 && unbanRes.body.license.status === 'active' ? '✅ PASS' : '❌ FAIL');

  // 10. Device A Heartbeat succeeds again
  const restoredHb = await request('POST', '/api/license/heartbeat', {
    licenseKey: key,
    hwid: 'DEVICE-HWID-ALPHA-123'
  });
  console.log('10. Heartbeat Restored After Unban:', restoredHb.status === 200 && restoredHb.body.valid === true ? '✅ PASS' : '❌ FAIL');

  console.log('--- ALL BACKEND SUITE TESTS COMPLETED ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
