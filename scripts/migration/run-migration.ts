#!/usr/bin/env node

/**
 * Migration runner script
 * Calls the Vercel API endpoint to run the migration
 * 
 * Usage: npx tsx scripts/migration/run-migration.ts
 */

const MIGRATION_KEY = 'prod-migrate-2024-secure-key'
const VERCEL_URL = 'https://dabdoob-cx-productivity.vercel.app'

async function runMigration() {
  console.log('🚀 Starting data migration...')
  console.log(`📍 Target: ${VERCEL_URL}/api/admin/migrate`)
  console.log('')

  try {
    const response = await fetch(`${VERCEL_URL}/api/admin/migrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-migration-key': MIGRATION_KEY,
      },
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('❌ Migration failed:')
      console.error(result)
      process.exit(1)
    }

    console.log('✅ Migration completed!')
    console.log('')
    console.log('📊 Results:')
    console.log(JSON.stringify(result, null, 2))

    if (result.tables) {
      console.log('')
      console.log('📋 Tables migrated:')
      Object.entries(result.tables as Record<string, { migrated?: number; errors?: string[] }>).forEach(([table, data]) => {
        console.log(`  ${table}: ${data.migrated} rows`)
        if (data.errors && data.errors.length > 0) {
          console.log(`    ⚠️  Errors: ${data.errors.join(', ')}`)
        }
      })
    }

    if (result.errors && result.errors.length > 0) {
      console.log('')
      console.log('⚠️  Errors encountered:')
      result.errors.forEach((err: string) => console.log(`  - ${err}`))
    }

    process.exit(result.success ? 0 : 1)
  } catch (error) {
    console.error('❌ Migration failed with error:')
    console.error(error)
    process.exit(1)
  }
}

runMigration()
