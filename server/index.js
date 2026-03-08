import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import extensivRoutes from './routes/extensiv.js';
import smartsheetRoutes from './routes/smartsheet.js';
import extensivSettingsRoutes from './routes/extensivSettings.js';
import customersRoutes from './routes/customers.js';
import healthCheckRoutes from './routes/healthCheck.js';
import asnsRoutes from './routes/asns.js';
import migrateRoutes from './routes/migrate.js';
import deliveriesRoutes from './routes/deliveries.js';
import itemsRoutes from './routes/items.js';
import appSettingsRoutes from './routes/appSettings.js';
import { debugStorage } from './lib/storageDebug.js';
import { runMigrations } from './migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Run database migrations on startup
(async () => {
  try {
    if (process.env.DATABASE_URL) {
      console.log('🔄 Running database migrations...');
      await runMigrations();
      console.log('✅ Database migrations completed');
    } else {
      console.log('ℹ️  DATABASE_URL not set, skipping migrations');
    }
  } catch (error) {
    console.error('❌ Failed to run migrations:', error);
    // Don't exit - allow the app to start even if migrations fail
  }
})();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    emailService: process.env.RESEND_API_KEY ? 'configured' : 'not configured'
  });
});

// Version info
app.get('/api/version', (req, res) => {
  res.json({
    version: '1.0.0',
    backend: 'railway',
    timestamp: new Date().toISOString()
  });
});

// Storage debug endpoint
app.get('/api/debug/storage', (req, res) => {
  const originalLog = console.log;
  const logs = [];
  
  console.log = (...args) => {
    logs.push(args.join(' '));
    originalLog(...args);
  };
  
  debugStorage();
  
  console.log = originalLog;
  
  res.json({ logs });
});

// API Routes
app.use('/api/extensiv', extensivRoutes);
app.use('/api/smartsheet', smartsheetRoutes);
app.use('/api/extensiv-settings', extensivSettingsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/health-check', healthCheckRoutes);
app.use('/api/asns', asnsRoutes);
app.use('/api/migrate', migrateRoutes);
app.use('/api/deliveries', deliveriesRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/app-settings', appSettingsRoutes);

// Debug endpoint - list all registered routes
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const path = middleware.regexp.source
            .replace('\\\\/?', '')
            .replace('(?=\\\\/|$)', '')
            .replace(/\\\\\//g, '/')
            .replace('^', '');
          routes.push({
            path: path + handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  
  res.json({ routes });
});

// Serve static frontend files from public/
app.use(express.static(path.join(__dirname, 'public')));

// SPA catch-all: serve index.html for any non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Warehouse Management Backend running on port ${PORT}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
  console.log(`[Server] Volume health check: http://localhost:${PORT}/api/health-check`);
  console.log(`[Server] Extensiv API: http://localhost:${PORT}/api/extensiv/*`);
  console.log(`[Server] Smartsheet API: http://localhost:${PORT}/api/smartsheet/*`);
  console.log(`[Server] Extensiv Settings API: http://localhost:${PORT}/api/extensiv-settings`);
  console.log(`[Server] Customers API: http://localhost:${PORT}/api/customers`);
  console.log(`[Server] ASNs API: http://localhost:${PORT}/api/asns`);
  console.log(`[Server] Deliveries API: http://localhost:${PORT}/api/deliveries/*`);
  console.log(`[Server] Items API: http://localhost:${PORT}/api/items`);
  console.log(`[Server] Migration API: http://localhost:${PORT}/api/migrate/*`);
  
  // Run storage debug on startup
  console.log('\n[Server] Running storage diagnostics...');
  debugStorage();
});