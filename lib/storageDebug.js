import fs from 'fs';
import path from 'path';

const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT;

export function debugStorage() {
  console.log('\n========== STORAGE DEBUG INFO ==========');
  console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
  console.log('IS_RAILWAY:', IS_RAILWAY);
  console.log('Current working directory:', process.cwd());
  
  const testPaths = [
    '/data',
    '/data/storage',
    path.join(process.cwd(), 'storage')
  ];
  
  testPaths.forEach(testPath => {
    console.log(`\nChecking path: ${testPath}`);
    try {
      const exists = fs.existsSync(testPath);
      console.log(`  - Exists: ${exists}`);
      
      if (exists) {
        const stats = fs.statSync(testPath);
        console.log(`  - Is Directory: ${stats.isDirectory()}`);
        console.log(`  - Permissions: ${(stats.mode & parseInt('777', 8)).toString(8)}`);
        
        if (stats.isDirectory()) {
          const files = fs.readdirSync(testPath);
          console.log(`  - Files: ${files.length > 0 ? files.join(', ') : 'empty'}`);
        }
      }
      
      // Test write access
      const testFile = path.join(testPath, 'test-write.txt');
      try {
        fs.writeFileSync(testFile, 'test content');
        console.log(`  - Write Test: SUCCESS`);
        fs.unlinkSync(testFile);
      } catch (writeError) {
        console.log(`  - Write Test: FAILED - ${writeError.message}`);
      }
    } catch (error) {
      console.log(`  - Error: ${error.message}`);
    }
  });
  
  console.log('\n========================================\n');
}
