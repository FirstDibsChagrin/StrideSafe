import json
import os
from datetime import datetime, timezone, timedelta

from services.db import get_supabase

# ── ML model (lazy-loaded once, None if artifacts are missing) ────────────────

_model = None
_feature_names: list[str] | None = None

def _load_ml():
    global _model, _feature_names
    if _model is not None:
        return _model, _feature_names

    # Resolve paths relative to this file: backend/services/ → repo-root/ml/
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    model_path = os.path.join(base, "ml", "model.pkl")
    features_path = os.path.join(base, "ml", "feature_names.json")

    if not os.path.exists(model_path) or not os.path.exists(features_path):
        return None, None

    try:
        import joblib
        _model = joblib.load(model_path)
        with open(features_path) as f:
            _feature_names = json.load(f)
    except Exception:
        _model = None
        _feature_names = None

    return _model, _feature_names


# ── Gender encoding (matches ml/train.py) ─────────────────────────────────────

def _encode_gender(gender: str | None) -> int:
    if not gender:
        return 0
    g = gender.lower().strip()
    if g in ("male", "man", "m"):
        return 1
    if g in ("female", "woman", "f"):
        return 2
    return 3


# ── Main entry point ──────────────────────────────────────────────────────────

def compute_risk_score(user_id: str) -> dict:
    supabase = get_supabase()
    today = str(datetime.now(timezone.utc).date())
    seven_days_ago = str((datetime.now(timezone.utc) - timedelta(days=7)).date())

    # Fetch all needed data in parallel-ish calls
    metrics_result = (
        supabase.table("training_metrics")
        .select("*")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    prior_result = (
        supabase.table("training_metrics")
        .select("weekly_mileage_km")
        .eq("user_id", user_id)
        .lte("date", seven_days_ago)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    checkin_result = (
        supabase.table("daily_checkins")
        .select("*")
        .eq("user_id", user_id)
        .order("checkin_date", desc=True)
        .limit(1)
        .execute()
    )
    activities_result = (
        supabase.table("activities")
        .select("activity_date,avg_pace_sec_per_km")
        .eq("user_id", user_id)
        .order("activity_date", desc=True)
        .limit(14)
        .execute()
    )
    profile_result = (
        supabase.table("profiles")
        .select("age,gender")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    metrics = (metrics_result.data or [{}])[0]
    prior_metrics = (prior_result.data or [{}])[0]
    checkin = (checkin_result.data or [{}])[0]
    activities = activities_result.data or []
    profile = (profile_result.data or [{}])[0]

    # ── Extract shared features ────────────────────────────────────────────────
    acwr = float(metrics.get("acwr") or 0)
    chronic_load = float(metrics.get("chronic_load") or 0)
    training_monotony = float(metrics.get("training_monotony") or 0)
    training_strain = float(metrics.get("training_strain") or 0)
    weekly_mileage = float(metrics.get("weekly_mileage_km") or 0)
    prev_weekly = float(prior_metrics.get("weekly_mileage_km") or 0)

    pain_level = int(checkin.get("pain_level") or 0)
    fatigue_level = int(checkin.get("fatigue_level") or 0)
    stress_level = int(checkin.get("stress_level") or 0)
    sleep_hours = float(checkin.get("sleep_hours") or 8.0)

    # Days since last rest (gap in activity dates)
    days_since_rest = _compute_days_since_rest(activities)

    # Average pace over last 7 days
    avg_pace = _compute_avg_pace(activities, days=7)

    age = int(profile.get("age") or 16)
    gender_encoded = _encode_gender(profile.get("gender"))

    # ── Try ML scoring ─────────────────────────────────────────────────────────
    model, feature_names = _load_ml()
    model_version = "rule-based-v1"
    score = 0

    if model is not None and feature_names is not None:
        try:
            import numpy as np
            feature_values = {
                "acwr": acwr,
                "weekly_mileage_km": weekly_mileage,
                "days_since_rest": float(days_since_rest),
                "avg_pace_sec_per_km": avg_pace,
                "fatigue_level": float(fatigue_level),
                "pain_level": float(pain_level),
                "stress_level": float(stress_level),
                "age": float(age),
                "gender_encoded": float(gender_encoded),
            }
            vector = np.array([[feature_values.get(f, 0.0) for f in feature_names]])
            prob = float(model.predict_proba(vector)[0][1])  # P(injury)
            score = round(prob * 100)
            model_version = "xgboost-v1"
        except Exception:
            pass  # fall through to rule-based

    # ── Rule-based scoring (used when ML unavailable or as fallback) ───────────
    if model_version == "rule-based-v1":
        score = _rule_based_score(
            acwr=acwr,
            chronic_load=chronic_load,
            training_monotony=training_monotony,
            training_strain=training_strain,
            weekly_mileage=weekly_mileage,
            prev_weekly=prev_weekly,
            pain_level=pain_level,
            fatigue_level=fatigue_level,
            stress_level=stress_level,
            sleep_hours=sleep_hours,
        )

    score = max(0, min(100, score))

    # ── Recommendations (always rule-based — interpretable) ───────────────────
    recommendations = _build_recommendations(
        acwr=acwr,
        chronic_load=chronic_load,
        training_monotony=training_monotony,
        weekly_mileage=weekly_mileage,
        prev_weekly=prev_weekly,
        pain_level=pain_level,
        fatigue_level=fatigue_level,
        stress_level=stress_level,
        sleep_hours=sleep_hours,
    )

    onset_days = 3 if score > 70 else (7 if score >= 40 else 14)

    row = {
        "user_id": user_id,
        "date": today,
        "global_score": score,
        "severity_score": score,
        "onset_days": onset_days,
        "model_version": model_version,
        "recommendations": recommendations,
    }
    supabase.table("risk_scores").upsert(row, on_conflict="user_id,date").execute()
    return row


# ── Helpers ───────────────────────────────────────────────────────────────────

def _compute_days_since_rest(activities: list[dict]) -> int:
    """Count consecutive days with at least one activity going back from today."""
    if not activities:
        return 0
    today = datetime.now(timezone.utc).date()
    activity_dates = set()
    for a in activities:
        raw = a.get("activity_date")
        if raw:
            try:
                activity_dates.add(datetime.fromisoformat(str(raw)[:10]).date())
            except ValueError:
                pass
    streak = 0
    check = today
    for _ in range(14):
        if check in activity_dates:
            streak += 1
            check -= timedelta(days=1)
        else:
            break
    return streak


def _compute_avg_pace(activities: list[dict], days: int = 7) -> float:
    """Average pace (sec/km) over the last `days` days. Returns 330 if unknown."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date()
    paces = []
    for a in activities:
        raw = a.get("activity_date")
        pace = a.get("avg_pace_sec_per_km")
        if raw and pace:
            try:
                if datetime.fromisoformat(str(raw)[:10]).date() >= cutoff:
                    paces.append(float(pace))
            except ValueError:
                pass
    return sum(paces) / len(paces) if paces else 330.0


def _rule_based_score(
    acwr, chronic_load, training_monotony, training_strain,
    weekly_mileage, prev_weekly, pain_level, fatigue_level,
    stress_level, sleep_hours,
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


def _build_recommendations(
    acwr, chronic_load, training_monotony, weekly_mileage, prev_weekly,
    pain_level, fatigue_level, stress_level, sleep_hours,
) -> list[str]:
    recs: list[str] = []
    if acwr > 1.3:
        recs.append("Reduce mileage by 20% this week")
    elif acwr < 0.8 and chronic_load > 0:
        recs.append("Gradually increase training load")
    if training_monotony > 2.0:
        recs.append("Add variety — mix easy runs with workouts")
    if pain_level >= 5:
        recs.append("Rest today and consult your coach")
    if sleep_hours < 6:
        recs.append("Prioritize 8+ hours of sleep tonight")
    if stress_level > 7:
        recs.append("Consider an easy effort run today")
    if prev_weekly > 0 and weekly_mileage > prev_weekly * 1.3:
        recs.append("Your mileage jumped sharply — take an easy day")
    return recs
