const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env variables
let SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wbqzlxdyjdmbzifhsyil.supabase.co';

try {
  const envPath = path.join(__dirname, 'frontend', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = (match[2] || '').trim();
        if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.length > 1 && value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
          SERVICE_ROLE_KEY = value;
        } else if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
          SUPABASE_URL = value;
        }
      }
    }
  }
} catch (err) {
  console.error(err);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const tables = [
    'belarro_v4_crop',
    'belarro_v4_customer',
    'belarro_v4_order',
    'belarro_v4_seeding_batch',
    'belarro_v4_harvest_record',
    'belarro_v4_seed_inventory',
    'belarro_v4_package_inventory',
    'belarro_v4_sample_inventory',
    'belarro_v4_invoice',
    'belarro_v4_follow_up'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table ${table} NOT ready:`, error.message);
    } else {
      console.log(`✅ Table ${table} is accessible and ready!`);
    }
  }
}

main().catch(console.error);
