const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
    if (configData && configData.length > 0) {
      console.log('   Sample config:', configData[0])
    }
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

  console.log('\nDatabase verification complete!')
}

verifyTables().catch(console.error)
