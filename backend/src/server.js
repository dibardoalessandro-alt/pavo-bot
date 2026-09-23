const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const licenseRoutes = require('./routes/licenseRoutes');
const adminRoutes = require('./routes/adminRoutes');
const boosterRoutes = require('./routes/boosterRoutes');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: '*' }));

// Body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${new Date().toISOString()} | ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | ${duration}ms | IP: ${ip}`);
  });
  next();
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'pavo-license-backend',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'online', timestamp: new Date().toISOString() });
});

// Mount Routes
app.use('/api/license', licenseRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/booster', boosterRoutes);

// 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({
    success: false,
    error: 'InternalServerError',
    message: config.nodeEnv === 'development' ? err.message : 'An unexpected error occurred.'
  });
});

// Start Server
const server = app.listen(config.port, config.host, () => {
  console.log('======================================================');
  console.log(`🚀 Pavo License Backend API is running!`);
  console.log(`📡 URL: http://${config.host}:${config.port}`);
  console.log(`🔒 Mode: ${config.nodeEnv}`);
  console.log(`📁 Database: ${config.dbPath}`);
  console.log('======================================================');
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n[SHUTDOWN] Received ${signal}. Closing server gracefully...`);
  server.close(() => {
    console.log('[SHUTDOWN] HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[SHUTDOWN] Force exiting after 5s timeout.');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
