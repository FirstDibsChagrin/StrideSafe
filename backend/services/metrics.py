from datetime import datetime, timezone, timedelta

import numpy as np

from services.db import get_supabase


def compute_metrics(user_id: str) -> dict:
    supabase = get_supabase()

    result = (
        supabase.table("activities")
        .select("activity_date,distance_meters")
        .eq("user_id", user_id)
        .execute()
    )
    activities = result.data or []

    today = datetime.now(timezone.utc).date()

    # Build a dict of daily km for the last 90 days, all initialised to 0
    daily_km: dict = {today - timedelta(days=i): 0.0 for i in range(89, -1, -1)}

    for activity in activities:
        date_str = activity.get("activity_date") or ""
        if not date_str:
            continue
        try:
            act_date = datetime.fromisoformat(date_str.replace("Z", "+00:00")).date()
        except ValueError:
            continue
        if act_date in daily_km:
            daily_km[act_date] += float(activity.get("distance_meters") or 0) / 1000.0

    loads = np.array([daily_km[d] for d in sorted(daily_km.keys())], dtype=float)

    last_7 = loads[-7:]
    last_28 = loads[-28:]

    acute_load = float(np.mean(last_7))
    chronic_load = float(np.mean(last_28))
    acwr = acute_load / chronic_load if chronic_load > 0 else 0.0

    std_7 = float(np.std(last_7))
    training_monotony = float(np.mean(last_7)) / std_7 if std_7 > 0 else 0.0
    training_strain = float(np.sum(last_7)) * training_monotony
    weekly_mileage_km = float(np.sum(last_7))

    row = {
        "user_id": user_id,
        "date": str(today),
        "acute_load": acute_load,
        "chronic_load": chronic_load,
        "acwr": acwr,
        "training_monotony": training_monotony,
        "training_strain": training_strain,
        "weekly_mileage_km": weekly_mileage_km,
    }

    supabase.table("training_metrics").upsert(row, on_conflict="user_id,date").execute()
    return row
