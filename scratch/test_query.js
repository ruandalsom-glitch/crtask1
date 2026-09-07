const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SUPABASE_ANON_KEY = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const userId = 'ff340be6-88cf-4310-9d0e-3c8ac7f164f5'; // Letícia
  console.log('Testing query for user:', userId);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
  console.log('PROFILE ROLE:', profile);

  const { data: members, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(*)')
    .eq('user_id', userId);

  console.log('MEMBERS DATA:', JSON.stringify(members, null, 2), 'ERROR:', error);

  const workspacesMapped = members?.map((d) => d.workspaces).filter(Boolean) || [];
  console.log('MAPPED WORKSPACES:', workspacesMapped);
}

run();
