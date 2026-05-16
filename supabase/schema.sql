-- StrideSafe schema
-- All tables use UUIDs and reference auth.users via user_id (or id for profiles).
-- Run this in the Supabase SQL editor on a fresh project before applying rls_policies.sql.

-- ─── Teams ───────────────────────────────────────────────────────────────────
CREATE TABLE public.teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  school     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Profiles ────────────────────────────────────────────────────────────────
-- id mirrors auth.users.id (no separate user_id column).
CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('runner', 'coach')),
  full_name  TEXT,
  age        INTEGER,
  gender     TEXT,
  team_id    UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create a profiles row when a user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─── Strava connections ───────────────────────────────────────────────────────
CREATE TABLE public.strava_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strava_athlete_id BIGINT NOT NULL UNIQUE,
  access_token      TEXT NOT NULL,
  refresh_token     TEXT NOT NULL,
  token_expires_at  BIGINT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ─── Activities (synced from Strava) ─────────────────────────────────────────
CREATE TABLE public.activities (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strava_activity_id   BIGINT NOT NULL,
  activity_date        DATE,
  distance_meters      NUMERIC,
  duration_seconds     INTEGER,
  avg_pace_sec_per_km  NUMERIC,
  avg_heart_rate       NUMERIC,
  workout_type         TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, strava_activity_id)
);

-- ─── Training metrics (computed by backend) ───────────────────────────────────
CREATE TABLE public.training_metrics (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date               DATE NOT NULL,
  acute_load         NUMERIC,
  chronic_load       NUMERIC,
  acwr               NUMERIC,
  training_monotony  NUMERIC,
  training_strain    NUMERIC,
  weekly_mileage_km  NUMERIC,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- ─── Risk scores (computed by backend ML) ─────────────────────────────────────
CREATE TABLE public.risk_scores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  global_score     NUMERIC NOT NULL,   -- 0–100
  onset_days       INTEGER,            -- predicted days until injury
  recommendations  TEXT[],
  model_version    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- ─── Daily check-ins ──────────────────────────────────────────────────────────
CREATE TABLE public.daily_checkins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date    DATE NOT NULL,
  pain_level      INTEGER CHECK (pain_level BETWEEN 0 AND 10),
  fatigue_level   INTEGER CHECK (fatigue_level BETWEEN 0 AND 10),
  stress_level    INTEGER CHECK (stress_level BETWEEN 0 AND 10),
  sleep_hours     NUMERIC,
  soreness_notes  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);

-- ─── Injuries ─────────────────────────────────────────────────────────────────
CREATE TABLE public.injuries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  injury_type         TEXT NOT NULL,
  body_location       TEXT,
  start_date          DATE,
  severity            INTEGER CHECK (severity BETWEEN 1 AND 10),
  estimated_days_out  INTEGER,
  confirmed_by_coach  BOOLEAN NOT NULL DEFAULT FALSE,
  reported_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Coach notes ──────────────────────────────────────────────────────────────
CREATE TABLE public.coach_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  runner_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
