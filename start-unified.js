/**
 * Pavo Tweak Suite - Unified 24/7 Cloud & Local Launcher
 * Runs both the License Backend API and the Discord Bot inside a SINGLE process/container.
 * This ensures that on free cloud tiers (Render, Koyeb, Railway), it uses only ONE instance
 * and NEVER runs out of monthly free hours.
 */

const { fork } = require('child_process');
const path = require('path');

console.log('========================================================');
console.log('🚀 PAVO TWEAK SUITE - UNIFIED RUNNER');
console.log('Starting License Backend (port 5000) & Discord Bot (port 10000)...');
console.log('========================================================');

function startService(name, scriptPath, cwd, extraEnv = {}) {
  console.log(`[SUITE] Starting ${name}...`);
  const child = fork(scriptPath, [], {
    env: { ...process.env, ...extraEnv },
    cwd,
    stdio: 'inherit'
  });

  child.on('exit', (code, signal) => {
    console.warn(`[SUITE] ⚠️ ${name} stopped (code: ${code}, signal: ${signal}). Auto-restarting in 5s...`);
    setTimeout(() => {
      startService(name, scriptPath, cwd, extraEnv);
    }, 5000);
  });

  child.on('error', (err) => {
    console.error(`[SUITE] ❌ ${name} process error:`, err);
  });

  return child;
}

// 1. Start License Backend API internally on port 5000
startService(
  'License Backend API',
  path.join(__dirname, 'backend', 'src', 'server.js'),
  path.join(__dirname, 'backend'),
  { PORT: '5000', HOST: '0.0.0.0' }
);

// 2. Start Discord Bot & OAuth server (exposes public PORT)
startService(
  'Discord Bot & Verification Server',
  path.join(__dirname, 'pavo-bot', 'index.js'),
  path.join(__dirname, 'pavo-bot'),
  {
    PORT: process.env.PORT || '10000',
    INTERNAL_BACKEND_PORT: '5000',
    LICENSE_API_URL: 'http://127.0.0.1:5000'
  }
);

process.on('unhandledRejection', (reason) => {
  console.error('[SUITE] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[SUITE] Uncaught Exception:', err);
});

