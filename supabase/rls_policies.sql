-- ============================================================
-- StrideSafe — Row Level Security Policies
-- Paste this entire file into the Supabase SQL Editor and run it.
-- It is safe to re-run (uses CREATE OR REPLACE / IF NOT EXISTS / DROP IF EXISTS).
-- ============================================================


-- ─── Step 1: Enable RLS on every table ───────────────────────

ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE strava_connections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities           ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins       ENABLE ROW LEVEL SECURITY;
ALTER TABLE injuries             ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_metrics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoes                ENABLE ROW LEVEL SECURITY;


-- ─── Step 2: SECURITY DEFINER helpers ────────────────────────
-- These bypass RLS when called inside policies, preventing
-- recursive policy evaluation on the profiles table.

CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_user_team_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.profiles WHERE user_id = auth.uid();
$$;


-- ─── Step 3: profiles ────────────────────────────────────────

DROP POLICY IF EXISTS "profiles_select_own"         ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own"         ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"         ON profiles;
DROP POLICY IF EXISTS "profiles_coach_read_team"    ON profiles;

-- Users manage their own row
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Coaches can read runner profiles on their team (uses helper to avoid recursion)
CREATE POLICY "profiles_coach_read_team" ON profiles
  FOR SELECT USING (
    public.auth_user_role() = 'coach'
    AND public.auth_user_team_id() IS NOT NULL
    AND team_id = public.auth_user_team_id()
  );


-- ─── Step 4: strava_connections ──────────────────────────────

DROP POLICY IF EXISTS "strava_select_own"  ON strava_connections;
DROP POLICY IF EXISTS "strava_insert_own"  ON strava_connections;
DROP POLICY IF EXISTS "strava_update_own"  ON strava_connections;

CREATE POLICY "strava_select_own" ON strava_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "strava_insert_own" ON strava_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "strava_update_own" ON strava_connections
  FOR UPDATE USING (auth.uid() = user_id);


-- ─── Step 5: activities ──────────────────────────────────────
-- Backend uses the service role for inserts/upserts; runners and
-- coaches use SELECT only via the anon/user role.

DROP POLICY IF EXISTS "activities_select_own"        ON activities;
DROP POLICY IF EXISTS "activities_coach_read_team"   ON activities;

CREATE POLICY "activities_select_own" ON activities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "activities_coach_read_team" ON activities
  FOR SELECT USING (
    public.auth_user_role() = 'coach'
    AND EXISTS (
      SELECT 1 FROM public.profiles AS runner
      WHERE runner.user_id = activities.user_id
        AND runner.team_id = public.auth_user_team_id()
    )
  );


-- ─── Step 6: daily_checkins ──────────────────────────────────

DROP POLICY IF EXISTS "checkins_insert_own"       ON daily_checkins;
DROP POLICY IF EXISTS "checkins_select_own"       ON daily_checkins;
DROP POLICY IF EXISTS "checkins_coach_read_team"  ON daily_checkins;

CREATE POLICY "checkins_insert_own" ON daily_checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "checkins_select_own" ON daily_checkins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "checkins_coach_read_team" ON daily_checkins
  FOR SELECT USING (
    public.auth_user_role() = 'coach'
    AND EXISTS (
      SELECT 1 FROM public.profiles AS runner
      WHERE runner.user_id = daily_checkins.user_id
        AND runner.team_id = public.auth_user_team_id()
    )
  );


-- ─── Step 7: injuries ────────────────────────────────────────

DROP POLICY IF EXISTS "injuries_insert_own"         ON injuries;
DROP POLICY IF EXISTS "injuries_select_own"         ON injuries;
DROP POLICY IF EXISTS "injuries_coach_read_team"    ON injuries;
DROP POLICY IF EXISTS "injuries_coach_update_team"  ON injuries;

CREATE POLICY "injuries_insert_own" ON injuries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "injuries_select_own" ON injuries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "injuries_coach_read_team" ON injuries
  FOR SELECT USING (
    public.auth_user_role() = 'coach'
    AND EXISTS (
      SELECT 1 FROM public.profiles AS runner
      WHERE runner.user_id = injuries.user_id
        AND runner.team_id = public.auth_user_team_id()
    )
  );

-- Coaches can confirm (update) injuries for runners on their team
CREATE POLICY "injuries_coach_update_team" ON injuries
  FOR UPDATE USING (
    public.auth_user_role() = 'coach'
    AND EXISTS (
      SELECT 1 FROM public.profiles AS runner
      WHERE runner.user_id = injuries.user_id
        AND runner.team_id = public.auth_user_team_id()
    )
  );


-- ─── Step 8: training_metrics ────────────────────────────────
-- Backend inserts via service role; users and coaches read only.

DROP POLICY IF EXISTS "metrics_select_own"        ON training_metrics;
DROP POLICY IF EXISTS "metrics_coach_read_team"   ON training_metrics;

CREATE POLICY "metrics_select_own" ON training_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "metrics_coach_read_team" ON training_metrics
  FOR SELECT USING (
    public.auth_user_role() = 'coach'
    AND EXISTS (
      SELECT 1 FROM public.profiles AS runner
      WHERE runner.user_id = training_metrics.user_id
        AND runner.team_id = public.auth_user_team_id()
    )
  );


-- ─── Step 9: risk_scores ─────────────────────────────────────

DROP POLICY IF EXISTS "risk_select_own"        ON risk_scores;
DROP POLICY IF EXISTS "risk_coach_read_team"   ON risk_scores;

CREATE POLICY "risk_select_own" ON risk_scores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "risk_coach_read_team" ON risk_scores
  FOR SELECT USING (
    public.auth_user_role() = 'coach'
    AND EXISTS (
      SELECT 1 FROM public.profiles AS runner
      WHERE runner.user_id = risk_scores.user_id
        AND runner.team_id = public.auth_user_team_id()
    )
  );


-- ─── Step 10: coach_notes ────────────────────────────────────

DROP POLICY IF EXISTS "coach_notes_coach_all"     ON coach_notes;
DROP POLICY IF EXISTS "coach_notes_runner_read"   ON coach_notes;

-- Coaches can insert and read notes they authored
CREATE POLICY "coach_notes_coach_all" ON coach_notes
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Runners can read notes written about them
CREATE POLICY "coach_notes_runner_read" ON coach_notes
  FOR SELECT USING (auth.uid() = runner_id);


-- ─── Step 11: teams ──────────────────────────────────────────

DROP POLICY IF EXISTS "teams_authenticated_read"    ON teams;
DROP POLICY IF EXISTS "teams_authenticated_insert"  ON teams;

-- All signed-in users can browse teams (needed during onboarding)
CREATE POLICY "teams_authenticated_read" ON teams
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Any signed-in user can create a team (coaches during onboarding)
CREATE POLICY "teams_authenticated_insert" ON teams
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ─── Step 12: shoes ──────────────────────────────────────────

DROP POLICY IF EXISTS "shoes_select_own"  ON shoes;
DROP POLICY IF EXISTS "shoes_insert_own"  ON shoes;
DROP POLICY IF EXISTS "shoes_update_own"  ON shoes;

CREATE POLICY "shoes_select_own" ON shoes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "shoes_insert_own" ON shoes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "shoes_update_own" ON shoes
  FOR UPDATE USING (auth.uid() = user_id);


-- ============================================================
-- Auto-create profile on sign-up
-- ============================================================
-- Creates a profiles row the moment a new user registers so
-- auth.uid() lookups always find a row immediately.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role)
  VALUES (NEW.id, NEW.email, 'runner')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
