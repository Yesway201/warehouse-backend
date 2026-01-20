import express from 'express';
import cors from 'cors';
import smartsheetRouter from './routes/smartsheet.js';
import extensivRouter from './routes/extensiv.js';
import { getStorageInfo } from './lib/settingsStore.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Version endpoint for deployment verification
app.get('/api/version', (req, res) => {
  const storageInfo = getStorageInfo();
  
  res.json({
    apiVersion: 'incoming-filter-v2-2026-01-20',
    backendCommit: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
    deployedAt: new Date().toISOString(),
    nodeVersion: process.version,
    storage: storageInfo
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routers
app.use('/api/smartsheet', smartsheetRouter);
app.use('/api/extensiv', extensivRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Warehouse Management Backend API',
    version: 'incoming-filter-v2-2026-01-20',
    endpoints: {
      version: 'GET /api/version',
      health: 'GET /health',
      smartsheet: '/api/smartsheet/*',
      extensiv: '/api/extensiv/*'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

app.listen(PORT, () => {
  console.log(`[Server] Backend running on port ${PORT}`);
  console.log(`[Server] API Version: incoming-filter-v2-2026-01-20`);
  console.log(`[Server] Commit: ${process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown'}`);
  console.log(`[Server] Environment: ${process.env.RAILWAY_ENVIRONMENT || 'development'}`);
});