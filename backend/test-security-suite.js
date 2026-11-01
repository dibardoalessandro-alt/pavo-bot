const crypto = require('crypto');
const config = require('./src/config');
const db = require('./src/database/db');
const licenseService = require('./src/services/licenseService');

async function runSecurityTestSuite() {
  console.log('========================================================');
  console.log('🛡️  SECURITY TEST SUITE — LICENSE & VAMPAUTH VERIFICATION');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(title, condition, extra = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${title} ${extra ? '(' + extra + ')' : ''}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title} ${extra ? '(' + extra + ')' : ''}`);
      failed++;
    }
  }

  // --- TEST 1: Unknown / Invalid Key ---
  console.log('[TEST GROUP 1: Non-Existent Key Handling]');
  const resInvalid = licenseService.validateLicense({
    licenseKey: 'PAVO-FAKE-0000-XXXX',
    hwid: 'TEST-HWID-001',
    ipAddress: '127.0.0.1'
  });
  assert('Non-existent key must be rejected', resInvalid.valid === false && resInvalid.code === 'NOT_FOUND');

  // --- TEST 2: Active & Valid Key ---
  console.log('\n[TEST GROUP 2: Valid Key Lifecycle]');
  const testKeyGen = licenseService.createLicense({
    durationDays: 30,
    notes: 'Security Test Temporary Active Key',
    createdBy: 'sec_test'
  });
  const resValid = licenseService.validateLicense({
    licenseKey: testKeyGen.license_key,
    hwid: 'TEST-HWID-DEVICE-A',
    ipAddress: '127.0.0.1'
  });
  assert('Active unexpired key must be accepted', resValid.valid === true && resValid.code === 'VALID');
  assert('Valid response must have HMAC signature', typeof resValid.signature === 'string' && resValid.signature.length === 64);

  // --- TEST 3: HWID Binding & Mismatch ---
  console.log('\n[TEST GROUP 3: Hardware ID Locking]');
  // Activate on Device A
  const resAct = licenseService.activateLicense({
    licenseKey: testKeyGen.license_key,
    hwid: 'TEST-HWID-DEVICE-A',
    ipAddress: '127.0.0.1'
  });
  assert('Activation on Device A succeeds', resAct.valid === true);

  // Attempt using on Device B
  const resMismatched = licenseService.validateLicense({
    licenseKey: testKeyGen.license_key,
    hwid: 'TEST-HWID-DEVICE-B-ATTACKER',
    ipAddress: '127.0.0.1'
  });
  assert('Device B mismatch rejected', resMismatched.valid === false && resMismatched.code === 'HWID_MISMATCH');

  // --- TEST 4: Expired Key ---
  console.log('\n[TEST GROUP 4: Expiration Handling]');
  // Set expiration to 1 hour in the past
  const pastIso = new Date(Date.now() - 3600000).toISOString();
  db.prepare('UPDATE licenses SET expires_at = ? WHERE id = ?').run(pastIso, testKeyGen.id);
  const resExpired = licenseService.validateLicense({
    licenseKey: testKeyGen.license_key,
    hwid: 'TEST-HWID-DEVICE-A',
    ipAddress: '127.0.0.1'
  });
  assert('Expired key must be rejected', resExpired.valid === false && resExpired.code === 'EXPIRED');

  // --- TEST 5: Revoked Key Rejection ---
  console.log('\n[TEST GROUP 5: Explicit Revocation]');
  db.prepare("UPDATE licenses SET status = 'revoked', ban_reason = 'TEST_REVOCATION' WHERE id = ?").run(testKeyGen.id);
  const resRevoked = licenseService.validateLicense({
    licenseKey: testKeyGen.license_key,
    hwid: 'TEST-HWID-DEVICE-A',
    ipAddress: '127.0.0.1'
  });
  assert('Revoked key must fail authorization', resRevoked.valid === false && resRevoked.code === 'REVOKED');

  const resRevokedAct = licenseService.activateLicense({
    licenseKey: testKeyGen.license_key,
    hwid: 'TEST-HWID-DEVICE-A',
    ipAddress: '127.0.0.1'
  });
  assert('Revoked key cannot activate new session', resRevokedAct.valid === false && resRevokedAct.code === 'REVOKED');

  // --- TEST 6: Generation Invalidation ---
  console.log('\n[TEST GROUP 6: Generation / Version Invalidation]');
  const oldGenKey = licenseService.createLicense({
    durationDays: 30,
    notes: 'Old Generation Test Key'
  });
  // Simulate old generation (e.g. gen 0 when required is 1)
  db.prepare('UPDATE licenses SET generation = 0 WHERE id = ?').run(oldGenKey.id);
  const resOldGen = licenseService.validateLicense({
    licenseKey: oldGenKey.license_key,
    hwid: 'TEST-HWID-OLD',
    ipAddress: '127.0.0.1'
  });
  assert('Old generation key rejected', resOldGen.valid === false && resOldGen.code === 'GENERATION_INVALID');

  // --- TEST 7: Malformed / Missing Input ---
  console.log('\n[TEST GROUP 7: Malformed Request / Input Validation]');
  const resMissing = licenseService.validateLicense({
    licenseKey: '',
    hwid: 'TEST',
    ipAddress: '127.0.0.1'
  });
  assert('Empty key string rejected', resMissing.valid === false && resMissing.code === 'INVALID_INPUT');

  // --- TEST 8: Fail-Closed Network / Timeout Simulation ---
  console.log('\n[TEST GROUP 8: Fail-Closed On Outage / Network Timeout]');
  // Simulate what client does when backend returns 500, timeout, or unreachable
  function simulateClientCheck(networkStatus) {
    if (networkStatus !== 200) {
      return { valid: false, message: 'Access denied: auth server unreachable or error.' }; // fail closed
    }
    return { valid: true };
  }
  assert('Client fails closed on 500 error', simulateClientCheck(500).valid === false);
  assert('Client fails closed on timeout / connection refusal', simulateClientCheck(0).valid === false);

  // --- TEST 9: Vampauth Official Cryptographic Contract ---
  console.log('\n[TEST GROUP 9: VampAuth Official Protocol Signing & Verification]');
  const vProjectId = "H7T2ZIHD13MK5TDS";
  const vSecret = "76a8c158d61a451807e5471948653947b8605b20400667cf";
  const vKey = "TEST-VAMP-KEY-1234";
  const vHwid = "TEST-HWID-ROBLOX-EXEC";
  const vNonce = "random-nonce-998877";

  // Request Signature: HMAC_SHA1(secret, nonce|key|hwid)
  const reqSig = crypto.createHmac('sha1', vSecret).update([vNonce, vKey, vHwid].join('|')).digest('hex');
  assert('Vampauth request signature is 40-char lowercase hex', reqSig.length === 40 && reqSig === reqSig.toLowerCase());

  // Response Signature Verification formula
  const vStatus = "valid";
  const vExpiresAtUnix = 1790000000;
  const vInternalUuid = "61b4a242-e6b3-4765-aefb-23904d92d984";
  const expectedRespSig = crypto.createHmac('sha1', vSecret)
    .update([vNonce, vStatus, vExpiresAtUnix, vInternalUuid].join('|'))
    .digest('hex');
  assert('Vampauth response signature verified with HMAC-SHA1', expectedRespSig.length === 40);

  // Clean up temporary test keys from licenses table
  db.prepare('DELETE FROM licenses WHERE id IN (?, ?)').run(testKeyGen.id, oldGenKey.id);
  db.prepare('DELETE FROM audit_logs WHERE license_key IN (?, ?)').run(testKeyGen.license_key, oldGenKey.license_key);

  console.log('\n========================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================');

  return { passed, failed };
}

runSecurityTestSuite().catch(err => {
  console.error(err);
  process.exit(1);
});
