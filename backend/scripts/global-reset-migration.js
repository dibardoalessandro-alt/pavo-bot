/**
 * CONTROLLED GLOBAL LICENSE RESET & MIGRATION SCRIPT
 * 
 * Safety Rules:
 * 1. Creates an automated timestamped backup before touching records.
 * 2. Only performs changes if `--execute` flag is explicitly passed.
 * 3. Sets all active/expired keys to 'revoked' so they cannot authorize new sessions.
 * 4. Increments the license generation counter.
 * 5. Does not touch unrelated tables (booster users, audit logs, discord users).
 */

const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const db = require('../src/database/db');
const licenseService = require('../src/services/licenseService');

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const reason = 'GLOBAL_RESET_REVOCATION_MIGRATION';

  console.log('===========================================================');
  console.log('🔒 PAVO LICENSE SYSTEM — CONTROLLED GLOBAL RESET MIGRATION');
  console.log('===========================================================');
  console.log(`Database: ${config.dbPath}`);
  console.log(`Current License Generation: ${config.licenseGeneration}`);

  // Fetch current licenses
  const allLicenses = db.prepare('SELECT * FROM licenses').all();
  const nonRevoked = allLicenses.filter(l => l.status !== 'revoked');
  const activeCount = allLicenses.filter(l => l.status === 'active').length;
  const expiredCount = allLicenses.filter(l => l.status === 'expired').length;
  const bannedCount = allLicenses.filter(l => l.status === 'banned').length;
  const revokedCount = allLicenses.filter(l => l.status === 'revoked').length;

  console.log(`\nCurrent License Summary:`);
  console.log(`- Total Records:     ${allLicenses.length}`);
  console.log(`- Active:            ${activeCount}`);
  console.log(`- Expired:           ${expiredCount}`);
  console.log(`- Banned:            ${bannedCount}`);
  console.log(`- Already Revoked:   ${revokedCount}`);
  console.log(`- Target for Reset:  ${nonRevoked.length}`);

  if (!isExecute) {
    console.log('\n[DRY RUN MODE] No changes have been made.');
    console.log('To execute the reset after explicit user approval, run:');
    console.log('  node scripts/global-reset-migration.js --execute');

    // Run a dry backup check
    const backupResult = licenseService.backupLicenses();
    console.log(`\nVerified safety backup generated at: ${backupResult.backupFile}`);
    process.exit(0);
  }

  console.log('\n[EXECUTE MODE] Performing irreversible migration...');
  const result = licenseService.globalLicenseReset({
    actor: 'admin_cli',
    reason,
    newGeneration: config.licenseGeneration + 1
  });

  console.log('\n✅ MIGRATION COMPLETED SUCCESSFULLY!');
  console.log(`- Pre-reset Backup:    ${result.backupFile}`);
  console.log(`- Keys Revoked:        ${result.keysRevoked}`);
  console.log(`- New Generation:      ${result.newGeneration}`);
  console.log('\nAll previously issued keys are now REVOKED and rejected by the validator.');
  console.log('Users must be issued new keys belonging to the current generation.');
}

main().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
