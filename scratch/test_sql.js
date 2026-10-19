const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim().replace(/"/g, '');
const SUPABASE_SERVICE_ROLE_KEY = envLocal.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/"/g, '');

async function run() {
  const endpoints = [
    '/rest/v1/rpc/exec_sql',
    '/pg/v1/query',
    '/database/v1/query'
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${SUPABASE_URL}${ep}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ query: "ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS visibility_mode TEXT DEFAULT 'own_only';" })
      });
      console.log(ep, res.status, await res.text());
    } catch (err) {
      console.log(ep, err.message);
    }
  }
}

run();
