const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SUPABASE_ANON_KEY = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('=== PROFILES ===');
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
  console.log(profiles, pErr);

  console.log('=== WORKSPACES ===');
  const { data: workspaces, error: wErr } = await supabase.from('workspaces').select('*');
  console.log(workspaces, wErr);

  console.log('=== WORKSPACE_MEMBERS ===');
  const { data: members, error: mErr } = await supabase.from('workspace_members').select('*');
  console.log(members, mErr);
}

run();
