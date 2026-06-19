const https = require('https');
const fs = require('fs');
const path = require('path');

// Load env variables from environment or frontend/.env.local
let SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'wbqzlxdyjdmbzifhsyil.supabase.co';

if (!SERVICE_ROLE_KEY) {
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
          // Remove wrapping quotes if any
          if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          } else if (value.length > 1 && value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
          }
          if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
            SERVICE_ROLE_KEY = value;
          } else if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
            SUPABASE_URL = value.replace(/^https?:\/\//, '');
          }
        }
      }
    }
  } catch (err) {
    console.error('Warning: Could not read frontend/.env.local:', err.message);
  }
}

if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is not defined in process.env or frontend/.env.local\n');
  process.exit(1);
}

// Load SQL file
const sqlFilePath = path.join(__dirname, 'SUPABASE_SETUP_EXTENDED.sql');
if (!fs.existsSync(sqlFilePath)) {
  console.error(`Error: SQL file not found at ${sqlFilePath}\n`);
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

// Parse statements (split by semicolon, clean comments)
const rawStatements = sqlContent.split(';');
const sqls = [];

for (let stmt of rawStatements) {
  // Strip comments (-- ...) and trim whitespace
  stmt = stmt
    .split('\n')
    .map(line => line.replace(/--.*$/, ''))
    .join('\n')
    .trim();

  if (stmt.length > 0) {
    sqls.push(stmt);
  }
}

async function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query: sql });
    const options = {
      hostname: SUPABASE_URL,
      port: 443,
      path: '/rest/v1/rpc/exec',
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, status: res.statusCode });
        } else {
          resolve({ success: false, status: res.statusCode, error: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log('Creating Belarro V4 Extended tables in Supabase...\n');

  for (let i = 0; i < sqls.length; i++) {
    const sql = sqls[i];
    const shortSql = sql.substring(0, 60).replace(/\n/g, ' ') + '...';
    process.stdout.write(`[${i + 1}/${sqls.length}] ${shortSql}`);

    try {
      const result = await executeSQL(sql);
      if (result.success) {
        console.log(' ✓');
      } else {
        console.log(` ✗ (${result.status})`);
        console.log(`  Error: ${result.error}`);
      }
    } catch (error) {
      console.log(` ✗`);
      console.log(`  Error: ${error.message}`);
    }
  }

  console.log('\n✅ Extended tables installation complete!');
}

main().catch(console.error);
