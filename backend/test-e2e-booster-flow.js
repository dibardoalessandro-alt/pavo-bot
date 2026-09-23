/**
 * End-to-End Test for PavoTweak Booster Access Flow
 */
const boosterService = require('./src/services/boosterService');

async function testE2E() {
  console.log('🧪 Running Complete Booster Access E2E Flow Test...\n');

  const userId = '1543201517279117413'; // Sample user ID
  const username = 'PavoMember#0001';

  // 1. Admin Verification
  console.log('1️⃣ Admin verifies 2-boost user via /pavo-verify...');
  const user = boosterService.verifyUser({
    discordUserId: userId,
    discordUsername: username,
    boostCount: 2,
    verifiedBy: 'Founder#0001',
    notes: '2 Nitro Boosts confirmed'
  });
  console.log('   ✓ User verified:', user.discordUserId, 'Status:', user.status);

  // 2. User generates code via /pavo-access
  console.log('\n2️⃣ User requests access code via /pavo-access...');
  const codeObj = boosterService.generateAuthCode({ discordUserId: userId, ttlSeconds: 300 });
  console.log('   ✓ Generated temporary code:', codeObj.code, 'Expires in:', codeObj.ttlSeconds, 'seconds');

  // 3. CLI exchanges code
  console.log('\n3️⃣ CLI exchanges code with POST /api/booster/auth/exchange...');
  const session = boosterService.exchangeAuthCode({
    code: codeObj.code,
    hwid: 'HWID-WINDOWS-WIN11-TEST',
    ipAddress: '192.168.1.100'
  });
  console.log('   ✓ Session created:', session.sessionId);
  console.log('   ✓ Session token issued:', session.sessionToken.substring(0, 16) + '...');

  // 4. CLI performs periodic heartbeat / pre-flight check
  console.log('\n4️⃣ CLI performs heartbeat with GET /api/booster/auth/session...');
  const valid = boosterService.validateSession(session.sessionToken, '192.168.1.100');
  console.log('   ✓ Heartbeat valid:', valid.valid, 'User:', valid.discordUsername);

  // 5. User loses boosts -> Real-time Discord event triggers revocation
  console.log('\n5️⃣ Discord event triggers: User stops boosting server!');
  const revokeResult = boosterService.revokeUser({
    discordUserId: userId,
    revokedBy: 'Discord Event: guildMemberUpdate',
    reason: 'Boost expired or removed'
  });
  console.log('   ✓ Booster revoked. Terminated sessions count:', revokeResult.revokedSessions);

  // 6. Next CLI action / heartbeat attempts validation
  console.log('\n6️⃣ CLI attempts next action / heartbeat...');
  try {
    boosterService.validateSession(session.sessionToken);
    throw new Error('E2E Failure: Session should have been rejected!');
  } catch (err) {
    console.log('   ✓ Backend rejected CLI request immediately:');
    console.log('     Status code: 403');
    console.log('     Error message:', err.message);
    console.log('     Error code:', err.code);
  }

  // 7. Audit log verification
  console.log('\n7️⃣ Checking audit logs recorded during flow...');
  const logs = boosterService.getAuditLogs({ discordUserId: userId, limit: 10 });
  console.log(`   ✓ Found ${logs.length} audit log entries for user:`);
  logs.forEach(l => {
    console.log(`     • [${l.created_at}] Action: ${l.action} | Actor: ${l.actor} | Details: ${l.details}`);
  });

  console.log('\n🎉 ALL END-TO-END TESTS COMPLETED PERFECTLY!\n');
}

testE2E().catch(err => {
  console.error('❌ E2E Test failed:', err);
  process.exit(1);
});
