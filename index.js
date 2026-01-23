import express from 'express';
import cors from 'cors';
import extensivRoutes from './routes/extensiv.js';
import smartsheetRoutes from './routes/smartsheet.js';
import extensivSettingsRoutes from './routes/extensivSettings.js';

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Version info
app.get('/api/version', (req, res) => {
  res.json({
    version: '1.0.0',
    backend: 'railway',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/extensiv', extensivRoutes);
app.use('/api/smartsheet', smartsheetRoutes);
app.use('/api/extensiv-settings', extensivSettingsRoutes);

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
            .replace('\\/?', '')
            .replace('(?=\\/|$)', '')
            .replace(/\\\//g, '/')
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
  console.log(`[Server] Extensiv API: http://localhost:${PORT}/api/extensiv/*`);
  console.log(`[Server] Smartsheet API: http://localhost:${PORT}/api/smartsheet/*`);
  console.log(`[Server] Extensiv Settings API: http://localhost:${PORT}/api/extensiv-settings`);
});