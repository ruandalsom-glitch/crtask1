const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim().replace(/"/g, '');
const SUPABASE_SERVICE_ROLE_KEY = envLocal.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/"/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function clean() {
  const estefanyId = '2b77c5c0-7b9f-4568-80eb-d7dc6a97f6c1';
  
  // 1. Apaga quadros de teste desnecessários criados durante a tentativa
  const junkNames = ['AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'gogogoooooooooooooo', 'Teste'];
  const { data: delJunk, error: delErr } = await supabase.from('boards').delete().in('name', junkNames);
  console.log('Deleted junk boards:', delJunk, delErr);

  // 2. Associa criador em quadros existentes
  const { data: updateRes, error: upErr } = await supabase
    .from('boards')
    .update({ created_by: estefanyId })
    .in('name', ['Teffy', 'teffy', 'tefy']);
  console.log('Updated Estefany boards created_by:', updateRes, upErr);
}

clean();
