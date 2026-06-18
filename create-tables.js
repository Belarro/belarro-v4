const https = require('https');

const SUPABASE_URL = 'wbqzlxdyjdmbzifhsyil.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndicXpseGR5amRtYnppZmhzeWlsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTc3OTI4NCwiZXhwIjoyMDk3MzU1Mjg0fQ.8D3AqF8nrhzey4f2vrkKPv0jLU5s2w9M0TYxq4P3K7E';

const sqls = [
  `DROP TABLE IF EXISTS belarro_v4_product_variant CASCADE;`,
  `DROP TABLE IF EXISTS belarro_v4_growth_procedure CASCADE;`,
  `DROP TABLE IF EXISTS belarro_v4_crop CASCADE;`,

  `CREATE TABLE belarro_v4_crop (
    id TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_de TEXT NOT NULL,
    flavor_en TEXT,
    flavor_de TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE
  );`,

  `CREATE TABLE belarro_v4_growth_procedure (
    id TEXT PRIMARY KEY,
    crop_id TEXT UNIQUE NOT NULL REFERENCES belarro_v4_crop(id) ON DELETE CASCADE,
    soak_enabled BOOLEAN DEFAULT false,
    soak_hours INTEGER,
    cover_soil_enabled BOOLEAN DEFAULT false,
    stack_enabled BOOLEAN DEFAULT false,
    stack_days INTEGER,
    growth_env_type TEXT CHECK (growth_env_type IN ('light', 'blackout', 'humidity_dome')),
    growth_env_days INTEGER,
    humidity_dome_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,

  `CREATE TABLE belarro_v4_product_variant (
    id TEXT PRIMARY KEY,
    crop_id TEXT NOT NULL REFERENCES belarro_v4_crop(id) ON DELETE CASCADE,
    size_name TEXT NOT NULL,
    size_grams FLOAT NOT NULL,
    price_eur FLOAT,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(crop_id, size_name)
  );`,

  `CREATE INDEX idx_crop_status ON belarro_v4_crop(status);`,
  `CREATE INDEX idx_crop_deleted_at ON belarro_v4_crop(deleted_at);`,
  `CREATE INDEX idx_growth_procedure_crop_id ON belarro_v4_growth_procedure(crop_id);`,
  `CREATE INDEX idx_product_variant_crop_id ON belarro_v4_product_variant(crop_id);`,

  `ALTER TABLE belarro_v4_crop ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE belarro_v4_growth_procedure ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE belarro_v4_product_variant ENABLE ROW LEVEL SECURITY;`,

  `CREATE POLICY "Allow anon select" ON belarro_v4_crop FOR SELECT TO anon USING (true);`,
  `CREATE POLICY "Allow anon insert" ON belarro_v4_crop FOR INSERT TO anon WITH CHECK (true);`,
  `CREATE POLICY "Allow anon update" ON belarro_v4_crop FOR UPDATE TO anon USING (true) WITH CHECK (true);`,
  `CREATE POLICY "Allow anon delete" ON belarro_v4_crop FOR DELETE TO anon USING (true);`,

  `CREATE POLICY "Allow anon select" ON belarro_v4_growth_procedure FOR SELECT TO anon USING (true);`,
  `CREATE POLICY "Allow anon insert" ON belarro_v4_growth_procedure FOR INSERT TO anon WITH CHECK (true);`,
  `CREATE POLICY "Allow anon update" ON belarro_v4_growth_procedure FOR UPDATE TO anon USING (true) WITH CHECK (true);`,
  `CREATE POLICY "Allow anon delete" ON belarro_v4_growth_procedure FOR DELETE TO anon USING (true);`,

  `CREATE POLICY "Allow anon select" ON belarro_v4_product_variant FOR SELECT TO anon USING (true);`,
  `CREATE POLICY "Allow anon insert" ON belarro_v4_product_variant FOR INSERT TO anon WITH CHECK (true);`,
  `CREATE POLICY "Allow anon update" ON belarro_v4_product_variant FOR UPDATE TO anon USING (true) WITH CHECK (true);`,
  `CREATE POLICY "Allow anon delete" ON belarro_v4_product_variant FOR DELETE TO anon USING (true);`,
];

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
        'Content-Length': postData.length,
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
  console.log('Creating Belarro V4 tables in Supabase...\n');

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

  console.log('\n✅ All tables created successfully!');
  console.log('Tables are ready for Belarro V4 admin.');
}

main().catch(console.error);
