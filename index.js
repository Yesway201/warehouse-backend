// ⚠️ DO NOT MODIFY – Smartsheet stable working configuration
// This file is part of the STABLE BASELINE (smartsheet-stable-v1.0)
// Any changes may break the working Smartsheet integration
// See: server/SMARTSHEET_BASELINE.md for details

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import extensivRoutes from './routes/extensiv.js';
import smartsheetRoutes from './routes/smartsheet.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - Allow all origins for App Viewer compatibility
// ⚠️ STABLE CORS CONFIG - DO NOT MODIFY
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests explicitly
app.options('*', cors());

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Atoms Backend API server is running' });
});

// Debug endpoint - list all registered routes
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  
  // Extract routes from app._router
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Direct route
      const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase());
      routes.push({
        path: middleware.route.path,
        methods: methods
      });
    } else if (middleware.name === 'router' && middleware.regexp) {
      // Router middleware - extract base path from regexp
      const regexpSource = middleware.regexp.source;
      let basePath = regexpSource
        .replace(/\\\//g, '/')
        .replace(/\^/g, '')
        .replace(/\$.*$/g, '')
        .replace(/\\/g, '')
        .replace(/\(\?.*?\)/g, '')
        .replace(/\/\?/g, '');
      
      // Clean up the path
      if (basePath && basePath !== '/') {
        middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            const methods = Object.keys(handler.route.methods).map(m => m.toUpperCase());
            routes.push({
              path: basePath + handler.route.path,
              methods: methods
            });
          }
        });
      }
    }
  });
  
  res.json({
    success: true,
    totalRoutes: routes.length,
    routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
    timestamp: new Date().toISOString()
  });
});

// API Routes - EXACT MOUNT PATHS
// ⚠️ STABLE ROUTE MOUNTING - DO NOT MODIFY ORDER OR PATHS
console.log('[Server] Mounting /api/extensiv routes...');
app.use('/api/extensiv', extensivRoutes);

console.log('[Server] Mounting /api/smartsheet routes...');
app.use('/api/smartsheet', smartsheetRoutes);

// Global 404 handler - return JSON
app.use((req, res) => {
  console.log(`[Server] 404: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method,
    message: 'This endpoint does not exist. Use GET /api/debug/routes to see all available routes.'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Atoms Backend API server running on http://localhost:${PORT}`);
  console.log(`📡 CORS enabled for all origins (App Viewer compatible)`);
  console.log(`✅ Preflight OPTIONS requests handled`);
  console.log(`✅ JSON middleware enabled`);
  console.log(`✅ Routes mounted: /api/extensiv, /api/smartsheet`);
  console.log(`🔍 Debug endpoint: GET /api/debug/routes`);
  console.log(`📋 Available Smartsheet endpoints:`);
  console.log(`   - GET    /api/smartsheet/settings`);
  console.log(`   - POST   /api/smartsheet/settings`);
  console.log(`   - DELETE /api/smartsheet/settings`);
  console.log(`   - GET    /api/smartsheet/columns`);
  console.log(`   - POST   /api/smartsheet/test-connection`);
  console.log(`   - POST   /api/smartsheet/sync-deliveries`);
  console.log(`   - POST   /api/smartsheet/update-delivery`);
  console.log(`⚠️  STABLE BASELINE LOCKED - See SMARTSHEET_BASELINE.md`);
});