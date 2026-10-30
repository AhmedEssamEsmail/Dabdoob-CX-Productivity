import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifyTables() {
  console.log('Checking if tables exist...')

  // Check config table
  const { data: configData, error: configError } = await supabase
    .from('config')
    .select('*')
    .limit(1)

  if (configError) {
    console.log('❌ Config table error:', configError.message)
  } else {
    console.log('✅ Config table exists')
  }

  // Check roster table
  const { data: rosterData, error: rosterError } = await supabase
    .from('roster')
    .select('*')
    .limit(1)

  if (rosterError) {
    console.log('❌ Roster table error:', rosterError.message)
  } else {
    console.log('✅ Roster table exists')
  }

  // Check view_as table
  const { data: viewAsData, error: viewAsError } = await supabase
    .from('view_as')
    .select('*')
    .limit(1)

  if (viewAsError) {
    console.log('❌ View_as table error:', viewAsError.message)
  } else {
    console.log('✅ View_as table exists')
  }

  // Check auth.users has custom columns
  const { data: columns, error: columnsError } = await supabase
    .rpc('get_columns', { table_name: 'users', schema_name: 'auth' })

  if (columnsError) {
    console.log('❌ Could not check auth.users columns')
  } else {
    console.log('✅ Auth users columns check:', columns)
  }
}

verifyTables()
