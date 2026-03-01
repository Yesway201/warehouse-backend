import fs from 'fs';
import path from 'path';

const possiblePaths = [
  '.atoms/backend.json',
  '.backend/config.json',
  'backend.config.json',
  '.env.backend'
];

console.log('Checking for backend configuration files...\n');
possiblePaths.forEach(p => {
  const fullPath = path.join(process.cwd(), p);
  if (fs.existsSync(fullPath)) {
    console.log(`Found: ${p}`);
    console.log(fs.readFileSync(fullPath, 'utf8'));
  }
});

console.log('\nChecking environment variables...');
Object.keys(process.env).filter(k => 
  k.includes('SUPABASE') || 
  k.includes('BACKEND') || 
  k.includes('ATOMS')
).forEach(k => {
  console.log(`${k}=${process.env[k]}`);
});
