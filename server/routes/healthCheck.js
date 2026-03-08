import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT;
const STORAGE_DIR = IS_RAILWAY ? '/data' : path.join(process.cwd(), 'storage');

router.get('/', async (req, res) => {
  console.log('[HealthCheck] GET /health-check');
  
  const checks = {
    timestamp: new Date().toISOString(),
    environment: {
      isRailway: IS_RAILWAY,
      railwayEnv: process.env.RAILWAY_ENVIRONMENT || 'NOT_SET',
      nodeEnv: process.env.NODE_ENV || 'NOT_SET'
    },
    storage: {
      configuredPath: STORAGE_DIR,
      exists: false,
      writable: false,
      readable: false,
      files: []
    },
    volumeTest: {
      testFilePath: null,
      writeSuccess: false,
      readSuccess: false,
      deleteSuccess: false,
      error: null
    }
  };

  try {
    // Check if storage directory exists
    checks.storage.exists = fs.existsSync(STORAGE_DIR);
    
    if (checks.storage.exists) {
      // Check if readable
      try {
        const files = fs.readdirSync(STORAGE_DIR);
        checks.storage.readable = true;
        checks.storage.files = files;
      } catch (error) {
        checks.storage.readable = false;
        checks.storage.readError = error.message;
      }
      
      // Test write capability
      const testFilePath = path.join(STORAGE_DIR, '.health-check-test.json');
      checks.volumeTest.testFilePath = testFilePath;
      
      try {
        // Write test
        const testData = {
          test: 'health-check',
          timestamp: new Date().toISOString(),
          random: Math.random()
        };
        fs.writeFileSync(testFilePath, JSON.stringify(testData, null, 2), 'utf8');
        checks.volumeTest.writeSuccess = true;
        checks.storage.writable = true;
        
        // Read test
        const readData = fs.readFileSync(testFilePath, 'utf8');
        const parsed = JSON.parse(readData);
        checks.volumeTest.readSuccess = (parsed.test === 'health-check');
        
        // Delete test
        fs.unlinkSync(testFilePath);
        checks.volumeTest.deleteSuccess = true;
        
      } catch (error) {
        checks.volumeTest.error = error.message;
        checks.storage.writable = false;
      }
    } else {
      // Try to create storage directory
      try {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
        checks.storage.exists = true;
        checks.storage.created = true;
      } catch (error) {
        checks.storage.createError = error.message;
      }
    }
    
    // Overall health status
    const isHealthy = checks.storage.exists && 
                     checks.storage.writable && 
                     checks.storage.readable &&
                     checks.volumeTest.writeSuccess &&
                     checks.volumeTest.readSuccess;
    
    res.json({
      status: isHealthy ? 'HEALTHY' : 'UNHEALTHY',
      checks
    });
    
  } catch (error) {
    console.error('[HealthCheck] Error:', error);
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      checks
    });
  }
});

export default router;