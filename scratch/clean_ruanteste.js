const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SUPABASE_ANON_KEY = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const userId = 'b4331796-1522-4c1b-a185-20aabb39bf0b'; // ruanteste
  // Keep ruanteste in Setor de Análise (id: 23e1b647-5c5a-4dfc-9ef0-0b3fa8b72ba6), remove from Setor de Marketing
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('user_id', userId)
    .eq('workspace_id', 'f64af3ea-23e2-4388-9c2a-a25e8c61f314');

  console.log('Removed duplicate workspace_member for ruanteste. Error:', error);
}

run();
