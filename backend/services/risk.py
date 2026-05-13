import json
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple

import numpy as np

from services.db import get_supabase

# ── ML model — lazy-loaded once per process ────────────────────────────────────
_model = None
_feature_cols: Optional[list] = None
_ml_checked = False


def _load_ml() -> Tuple[Optional[object], Optional[list]]:
    """
    Load model.pkl and feature_columns.json from the ml/ directory at the
    repository root.  Caches the result so the files are read only once.
    Returns (model, feature_cols) or (None, None) if the model is absent.
    """
    global _model, _feature_cols, _ml_checked
    if _ml_checked:
        return _model, _feature_cols

    _ml_checked = True

    # backend/services/risk.py → up two levels → repo root → ml/
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    model_path = os.path.join(repo_root, "ml", "model.pkl")
    features_path = os.path.join(repo_root, "ml", "feature_columns.json")

    if not os.path.exists(model_path):
        return None, None

    try:
        import joblib  # only required when model exists

        _model = joblib.load(model_path)
        with open(features_path) as f:
            _feature_cols = json.load(f)
        print(f"[INFO] ML model loaded ({len(_feature_cols)} features)")
    except Exception as exc:
        print(f"[WARN] Could not load ML model: {exc}")
        _model = None
        _feature_cols = None

    return _model, _feature_cols


# ── Recommendations (always run, regardless of scorer) ────────────────────────

def _build_recommendations(
    acwr: float,
    chronic_load: float,
    training_monotony: float,
    training_strain: float,
    weekly_mileage: float,
    prev_weekly: float,
    pain_level: int,
    fatigue_level: int,
    sleep_hours: float,
    stress_level: int,
) -> list:
    recs: list[str] = []

    if acwr > 1.5 or acwr >= 1.3:
        recs.append("Reduce mileage by 20% this week")
    elif acwr < 0.8 and chronic_load > 0:
        recs.append("Gradually increase training load")

    if training_monotony > 2.0:
        recs.append("Add variety — mix easy runs with workouts")

    if pain_level > 7 or pain_level >= 5:
        recs.append("Rest today and consult your coach")

    if sleep_hours < 6:
        recs.append("Prioritize 8+ hours of sleep tonight")

    if stress_level > 7:
        recs.append("Consider an easy effort run today")

    if prev_weekly > 0 and weekly_mileage > prev_weekly * 1.3:
        recs.append("Your mileage jumped sharply — take an easy day")

    return recs


# ── Rule-based scorer (fallback) ──────────────────────────────────────────────

def _rule_based_score(
    acwr: float,
    chronic_load: float,
    training_monotony: float,
    training_strain: float,
    weekly_mileage: float,
    prev_weekly: float,
    pain_level: int,
    fatigue_level: int,
    sleep_hours: float,
    stress_level: int,
) -> int:
    score = 0

    if acwr > 1.5:
        score += 40
    elif acwr >= 1.3:
        score += 25
    elif acwr < 0.8 and chronic_load > 0:
        score += 10

    if training_monotony > 2.0:
        score += 15
    if training_strain > 5000:
        score += 10

    if pain_level > 7:
        score += 20
    elif pain_level >= 5:
        score += 10

    if fatigue_level > 7:
        score += 10
    if sleep_hours < 6:
        score += 10
    if stress_level > 7:
        score += 5

    if prev_weekly > 0 and weekly_mileage > prev_weekly * 1.3:
        score += 15

    return min(score, 100)


# ── Main function ──────────────────────────────────────────────────────────────

def compute_risk_score(user_id: str) -> dict:
    supabase = get_supabase()

    # Fetch latest training metrics
    metrics_result = (
        supabase.table("training_metrics")
        .select("*")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )

    # Fetch previous week's metrics for mileage-change comparison
    seven_days_ago = str((datetime.now(timezone.utc) - timedelta(days=7)).date())
    prior_result = (
        supabase.table("training_metrics")
        .select("weekly_mileage_km")
        .eq("user_id", user_id)
        .lte("date", seven_days_ago)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )

    # Fetch latest check-in
    checkin_result = (
        supabase.table("daily_checkins")
        .select("*")
        .eq("user_id", user_id)
        .order("checkin_date", desc=True)
        .limit(1)
        .execute()
    )

    metrics = (metrics_result.data or [{}])[0]
    prior_metrics = (prior_result.data or [{}])[0]
    checkin = (checkin_result.data or [{}])[0]

    # ── Extract common values ──────────────────────────────────────────────────
    acwr              = float(metrics.get("acwr") or 0)
    chronic_load      = float(metrics.get("chronic_load") or 0)
    acute_load        = float(metrics.get("acute_load") or 0)
    training_monotony = float(metrics.get("training_monotony") or 0)
    training_strain   = float(metrics.get("training_strain") or 0)
    weekly_mileage    = float(metrics.get("weekly_mileage_km") or 0)
    prev_weekly       = float(prior_metrics.get("weekly_mileage_km") or 0)

    pain_level    = int(checkin.get("pain_level") or 0)
    fatigue_level = int(checkin.get("fatigue_level") or 0)
    stress_level  = int(checkin.get("stress_level") or 0)
    sleep_hours_raw = checkin.get("sleep_hours")
    sleep_hours   = float(sleep_hours_raw) if sleep_hours_raw is not None else 8.0

    mileage_change_pct = (
        (weekly_mileage - prev_weekly) / prev_weekly * 100
        if prev_weekly > 0 else 0.0
    )

    # ── Choose scorer ──────────────────────────────────────────────────────────
    model, feature_cols = _load_ml()

    if model is not None and feature_cols:
        # Fetch recent activities to supply pace, HR, and rest-day features
        fourteen_days_ago = str((datetime.now(timezone.utc) - timedelta(days=14)).date())
        acts_result = (
            supabase.table("activities")
            .select("activity_date,avg_pace_sec_per_km,avg_heart_rate,distance_meters")
            .eq("user_id", user_id)
            .gte("activity_date", fourteen_days_ago)
            .order("activity_date", desc=True)
            .execute()
        )
        recent_acts = acts_result.data or []

        last7_acts = recent_acts[:7]
        avg_pace_last7 = float(np.mean(
            [a["avg_pace_sec_per_km"] for a in last7_acts if a.get("avg_pace_sec_per_km")]
        ) if last7_acts else 0)
        avg_hr_last7 = float(np.mean(
            [a["avg_hr"] for a in last7_acts if a.get("avg_hr")]
        ) if last7_acts else 0)

        # Days since rest: count consecutive days with activity going backward
        days_since_rest = 0
        for act in recent_acts:
            dist = act.get("distance_meters") or 0
            if dist > 0:
                days_since_rest += 1
            else:
                break

        feat_dict = {
            "acwr":               acwr,
            "training_monotony":  training_monotony,
            "training_strain":    training_strain,
            "weekly_mileage_km":  weekly_mileage,
            "acute_load":         acute_load,
            "chronic_load":       chronic_load,
            "mileage_change_pct": mileage_change_pct,
            "avg_pace_last7":     avg_pace_last7,
            "avg_hr_last7":       avg_hr_last7,
            "days_since_rest":    float(days_since_rest),
        }

        feature_vector = [[feat_dict.get(col, 0.0) for col in feature_cols]]
        proba = float(model.predict_proba(feature_vector)[0][1])
        score = min(100, max(0, int(round(proba * 100))))
        model_version = "xgboost-v1"
    else:
        score = _rule_based_score(
            acwr, chronic_load, training_monotony, training_strain,
            weekly_mileage, prev_weekly,
            pain_level, fatigue_level, sleep_hours, stress_level,
        )
        model_version = "rule-based-v1"

    # ── Recommendations always run (rule-based logic regardless of scorer) ─────
    recommendations = _build_recommendations(
        acwr, chronic_load, training_monotony, training_strain,
        weekly_mileage, prev_weekly,
        pain_level, fatigue_level, sleep_hours, stress_level,
    )

    # ── Onset window ──────────────────────────────────────────────────────────
    if score > 70:
        onset_days = 3
    elif score >= 40:
        onset_days = 7
    else:
        onset_days = 14

    today = str(datetime.now(timezone.utc).date())

    row = {
        "user_id":       user_id,
        "date":          today,
        "global_score":  score,
        "severity_score": score,
        "onset_days":    onset_days,
        "model_version": model_version,
        "recommendations": recommendations,
    }

    supabase.table("risk_scores").upsert(row, on_conflict="user_id,date").execute()
    return row
