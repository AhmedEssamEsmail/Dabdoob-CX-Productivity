-- Paste once in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/uugeyulccyytvgcabzzx/sql
-- New tables created via the SQL editor get RLS enabled (Supabase default on
-- this project) with no policies, so the app's anon-key writes are rejected
-- with "new row violates row-level security policy". The app authenticates at
-- the route layer and writes through the anon client, matching the permissive
-- policies the other tables already carry.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fd_activities' AND policyname = 'app_all') THEN
    CREATE POLICY app_all ON fd_activities FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maqsam_calls' AND policyname = 'app_all') THEN
    CREATE POLICY app_all ON maqsam_calls FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'freshchat' AND policyname = 'app_all') THEN
    CREATE POLICY app_all ON freshchat FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'health' AND policyname = 'app_all') THEN
    CREATE POLICY app_all ON health FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'refresh_log' AND policyname = 'app_all') THEN
    CREATE POLICY app_all ON refresh_log FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
