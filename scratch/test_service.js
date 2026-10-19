const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim().replace(/"/g, '');
const SUPABASE_SERVICE_ROLE_KEY = envLocal.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/"/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('workspaces').select('*');
  console.log('Workspaces:', data, error);
}

test();
