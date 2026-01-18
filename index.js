import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import smartsheetRoutes from './routes/smartsheet.js';
import extensivRoutes from './routes/extensiv.js';
import credentialsRoutes from './routes/credentials.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - Allow all origins for App Viewer compatibility
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
  res.json({ status: 'ok', message: 'Backend API server is running' });
});

// API Routes
app.use('/api/smartsheet', smartsheetRoutes);
app.use('/api/extensiv', extensivRoutes);
app.use('/api/credentials', credentialsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend API server running on http://localhost:${PORT}`);
  console.log(`📡 CORS enabled for all origins (App Viewer compatible)`);
  console.log(`✅ Preflight OPTIONS requests handled`);
});