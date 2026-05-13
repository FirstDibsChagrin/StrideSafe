from datetime import datetime, timezone, timedelta

from services.db import get_supabase


def compute_risk_score(user_id: str) -> dict:
    supabase = get_supabase()

    metrics_result = (
        supabase.table("training_metrics")
        .select("*")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )

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

    score = 0
    recommendations: list[str] = []

    acwr = float(metrics.get("acwr") or 0)
    chronic_load = float(metrics.get("chronic_load") or 0)
    training_monotony = float(metrics.get("training_monotony") or 0)
    training_strain = float(metrics.get("training_strain") or 0)
    weekly_mileage = float(metrics.get("weekly_mileage_km") or 0)

    if acwr > 1.5:
        score += 40
        recommendations.append("Reduce mileage by 20% this week")
    elif acwr >= 1.3:
        score += 25
        recommendations.append("Reduce mileage by 20% this week")
    elif acwr < 0.8 and chronic_load > 0:
        score += 10
        recommendations.append("Gradually increase training load")

    if training_monotony > 2.0:
        score += 15
        recommendations.append("Add variety — mix easy runs with workouts")

    if training_strain > 5000:
        score += 10

    pain_level = int(checkin.get("pain_level") or 0)
    fatigue_level = int(checkin.get("fatigue_level") or 0)
    sleep_hours = checkin.get("sleep_hours")
    sleep_hours = float(sleep_hours) if sleep_hours is not None else 8.0
    stress_level = int(checkin.get("stress_level") or 0)

    if pain_level > 7:
        score += 20
        recommendations.append("Rest today and consult your coach")
    elif pain_level >= 5:
        score += 10
        recommendations.append("Rest today and consult your coach")

    if fatigue_level > 7:
        score += 10

    if sleep_hours < 6:
        score += 10
        recommendations.append("Prioritize 8+ hours of sleep tonight")

    if stress_level > 7:
        score += 5
        recommendations.append("Consider an easy effort run today")

    prev_weekly = float(prior_metrics.get("weekly_mileage_km") or 0)
    if prev_weekly > 0 and weekly_mileage > prev_weekly * 1.3:
        score += 15
        recommendations.append("Your mileage jumped sharply — take an easy day")

    score = min(score, 100)

    if score > 70:
        onset_days = 3
    elif score >= 40:
        onset_days = 7
    else:
        onset_days = 14

    today = str(datetime.now(timezone.utc).date())

    row = {
        "user_id": user_id,
        "date": today,
        "global_score": score,
        "severity_score": score,
        "onset_days": onset_days,
        "model_version": "rule-based-v1",
        "recommendations": recommendations,
    }

    supabase.table("risk_scores").upsert(row, on_conflict="user_id,date").execute()
    return row
