const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SUPABASE_ANON_KEY = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testUser(email) {
  console.log('\n----------------------------------------');
  console.log('TESTING FOR USER EMAIL:', email);

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', email)
    .single();

  if (pErr || !profile) {
    console.error('ERROR FETCHING PROFILE:', pErr);
    return;
  }

  console.log('PROFILE:', profile);

  if (profile.role === 'admin') {
    const { data: allW } = await supabase.from('workspaces').select('*').order('created_at');
    console.log('USER IS ADMIN -> ALLOWED WORKSPACES:', allW.map(w => w.name));
  } else {
    const { data: members, error: mErr } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(*)')
      .eq('user_id', profile.id);

    console.log('USER IS NOT ADMIN -> WORKSPACE_MEMBERS RAW:', JSON.stringify(members, null, 2), 'ERROR:', mErr);

    const mapped = members?.map((d) => d.workspaces).filter(Boolean) || [];
    console.log('ALLOWED WORKSPACES:', mapped.map(w => w.name));
  }
}

async function run() {
  const { data: profiles } = await supabase.from('profiles').select('email');
  for (const p of profiles) {
    await testUser(p.email);
  }
}

run();
