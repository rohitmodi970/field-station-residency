import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  const envPath = join(__dirname, '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  
  const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
  const supabaseKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
  
  console.log('Environment Variables Check:');
  console.log('✓ .env file found');
  console.log(`✓ NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT FOUND'}`);
  console.log(`✓ NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseKey ? 'SET (length: ' + supabaseKey.length + ')' : 'NOT FOUND'}`);
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('\n❌ Missing Supabase environment variables!');
    process.exit(1);
  }
  
  console.log('\n✓ All Supabase environment variables are set correctly');
} catch (error) {
  console.error('Error reading .env file:', error);
  process.exit(1);
}
