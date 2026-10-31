@echo off
REM Run the migration endpoint on Vercel
REM Usage: run-migration.bat

set MIGRATION_KEY=prod-migrate-2024-secure-key
set VERCEL_URL=https://dabdoob-cx-productivity.vercel.app

echo Starting data migration...
echo Target: %VERCEL_URL%/api/admin/migrate
echo.

curl -X POST ^
  -H "Content-Type: application/json" ^
  -H "x-migration-key: %MIGRATION_KEY%" ^
  "%VERCEL_URL%/api/admin/migrate"

echo.
echo Migration complete!
pause
