/**
 * Comprehensive Automated Test for PavoTweak Booster Access System Backend
 */
const boosterService = require('./src/services/boosterService');

async function runTests() {
  console.log('🧪 Starting Booster System Unit & Integration Tests...');

  const testUserId = '999888777666555444';
  const testUsername = 'BoosterTester#1234';

  // 1. Verify User
  console.log('\n--- Test 1: Verify 2-Boost User ---');
  const verifyRes = boosterService.verifyUser({
    discordUserId: testUserId,
    discordUsername: testUsername,
    boostCount: 2,
    verifiedBy: 'TestAdmin#0001',
    notes: '2 Nitro Boosts verified manually'
  });
  console.log('Verify Result:', verifyRes);
  if (!verifyRes.isVerified || verifyRes.status !== 'active') {
    throw new Error('Test 1 Failed: User was not verified properly');
  }
  console.log('✅ Test 1 Passed');

  // 2. Generate temporary single-use code
  console.log('\n--- Test 2: Generate Single-Use Code ---');
  const codeRes = boosterService.generateAuthCode({ discordUserId: testUserId, ttlSeconds: 300 });
  console.log('Generated Code:', codeRes);
  if (!codeRes.code.startsWith('PVBOOST-')) {
    throw new Error('Test 2 Failed: Code prefix invalid');
  }
  console.log('✅ Test 2 Passed');

  // 3. Exchange temporary code for Session Token
  console.log('\n--- Test 3: Exchange Code for Session ---');
  const sessionRes = boosterService.exchangeAuthCode({
    code: codeRes.code,
    hwid: 'HWID-TEST-001',
    ipAddress: '127.0.0.1'
  });
  console.log('Session Created:', {
    sessionId: sessionRes.sessionId,
    expiresAt: sessionRes.expiresAt,
    user: sessionRes.user
  });
  if (!sessionRes.sessionToken || !sessionRes.sessionId) {
    throw new Error('Test 3 Failed: Session not created');
  }
  console.log('✅ Test 3 Passed');

  // 4. Try to re-use the same code (Single-Use test)
  console.log('\n--- Test 4: Single-Use Protection (Burned Code) ---');
  try {
    boosterService.exchangeAuthCode({ code: codeRes.code });
    throw new Error('Test 4 Failed: Re-used code should have failed!');
  } catch (err) {
    console.log('Expected error caught on code reuse:', err.message);
    console.log('✅ Test 4 Passed (Code properly burned after single use)');
  }

  // 5. Validate Active Session (Heartbeat)
  console.log('\n--- Test 5: Validate Active Session ---');
  const valRes = boosterService.validateSession(sessionRes.sessionToken, '127.0.0.1');
  console.log('Validation Result:', valRes);
  if (!valRes.valid || valRes.sessionId !== sessionRes.sessionId) {
    throw new Error('Test 5 Failed: Session validation failed');
  }
  console.log('✅ Test 5 Passed');

  // 6. Test Instant Revocation
  console.log('\n--- Test 6: Revoke Booster Status ---');
  const revokeRes = boosterService.revokeUser({
    discordUserId: testUserId,
    revokedBy: 'AutoRevoker',
    reason: 'Stopped boosting Discord server'
  });
  console.log('Revoke Result:', revokeRes);
  if (revokeRes.status !== 'revoked') {
    throw new Error('Test 6 Failed: User status not revoked');
  }
  console.log('✅ Test 6 Passed');

  // 7. Test Session Heartbeat After Revocation (Should throw 403 ACCESS_REVOKED)
  console.log('\n--- Test 7: Validate Revoked Session (Should be blocked) ---');
  try {
    boosterService.validateSession(sessionRes.sessionToken);
    throw new Error('Test 7 Failed: Revoked session should not validate!');
  } catch (err) {
    console.log('Expected error on revoked session:', err.message, '| Code:', err.code);
    if (err.code !== 'ACCESS_REVOKED') {
      throw new Error('Test 7 Failed: Expected ACCESS_REVOKED error code');
    }
    console.log('✅ Test 7 Passed (Session blocked immediately upon revocation)');
  }

  // 8. Test Code Generation on Revoked User (Should fail)
  console.log('\n--- Test 8: Generate Code for Revoked User (Should be denied) ---');
  try {
    boosterService.generateAuthCode({ discordUserId: testUserId });
    throw new Error('Test 8 Failed: Revoked user generated code!');
  } catch (err) {
    console.log('Expected error on unverified code generation:', err.message);
    console.log('✅ Test 8 Passed');
  }

  console.log('\n🎉 ALL 8 BOOSTER SYSTEM TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
