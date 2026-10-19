const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim().replace(/"/g, '');
const SUPABASE_SERVICE_ROLE_KEY = envLocal.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/"/g, '');

async function run() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  const data = await res.json();
  console.log('shifts:', Object.keys(data.definitions.operational_shifts?.properties || {}));
  console.log('settings:', Object.keys(data.definitions.operational_shift_settings?.properties || {}));
  console.log('notifications:', Object.keys(data.definitions.notifications?.properties || {}));
}

run();
