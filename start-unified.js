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

const backendScript = path.join(__dirname, 'backend', 'src', 'server.js');
const botScript = path.join(__dirname, 'pavo-bot', 'index.js');

// 1. Start License Backend API internally on port 5000
const backendEnv = {
  ...process.env,
  PORT: '5000',
  HOST: '0.0.0.0'
};

const backend = fork(backendScript, [], {
  env: backendEnv,
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit'
});

// 2. Start Discord Bot & OAuth server (exposes public PORT 10000 or Render PORT)
const botEnv = {
  ...process.env,
  PORT: process.env.PORT || '10000',
  INTERNAL_BACKEND_PORT: '5000',
  LICENSE_API_URL: 'http://127.0.0.1:5000'
};

const bot = fork(botScript, [], {
  env: botEnv,
  cwd: path.join(__dirname, 'pavo-bot'),
  stdio: 'inherit'
});

function handleExit(code, service) {
  console.warn(`[SUITE] ${service} exited with code: ${code}`);
}

backend.on('exit', (code) => handleExit(code, 'Backend API'));
bot.on('exit', (code) => handleExit(code, 'Discord Bot'));

const cleanShutdown = (signal) => {
  console.log(`\n[SUITE] Shutting down on ${signal}...`);
  try { backend.kill(signal); } catch (_) {}
  try { bot.kill(signal); } catch (_) {}
  process.exit(0);
};

process.on('SIGINT', () => cleanShutdown('SIGINT'));
process.on('SIGTERM', () => cleanShutdown('SIGTERM'));
