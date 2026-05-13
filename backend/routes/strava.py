import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.db import get_supabase
from services.metrics import compute_metrics
from services.risk import compute_risk_score

router = APIRouter(prefix="/strava", tags=["strava"])


class SyncRequest(BaseModel):
    user_id: str


@router.post("/sync")
async def sync_strava(body: SyncRequest):
    supabase = get_supabase()

    result = (
        supabase.table("strava_connections")
        .select("*")
        .eq("user_id", body.user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No Strava connection found")

    conn = result.data[0]
    access_token: str = conn["access_token"]
    expires_at = conn.get("expires_at")

    now_ts = datetime.now(timezone.utc).timestamp()
    if expires_at and now_ts >= float(expires_at):
        async with httpx.AsyncClient() as client:
            refresh_resp = await client.post(
                "https://www.strava.com/oauth/token",
                data={
                    "client_id": os.environ.get("STRAVA_CLIENT_ID"),
                    "client_secret": os.environ.get("STRAVA_CLIENT_SECRET"),
                    "grant_type": "refresh_token",
                    "refresh_token": conn["refresh_token"],
                },
                timeout=15.0,
            )
        if refresh_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to refresh Strava token")
        token_data = refresh_resp.json()
        access_token = token_data["access_token"]
        supabase.table("strava_connections").update(
            {
                "access_token": access_token,
                "refresh_token": token_data["refresh_token"],
                "expires_at": token_data["expires_at"],
            }
        ).eq("user_id", body.user_id).execute()

    async with httpx.AsyncClient() as client:
        activities_resp = await client.get(
            "https://www.strava.com/api/v3/athlete/activities",
            params={"per_page": 90},
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30.0,
        )

    if activities_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch Strava activities")

    activities = activities_resp.json()
    synced = 0

    for activity in activities:
        distance_m = float(activity.get("distance") or 0)
        duration_s = int(activity.get("elapsed_time") or 0)
        distance_km = distance_m / 1000.0
        avg_pace = duration_s / distance_km if distance_km > 0 else 0.0

        row = {
            "user_id": body.user_id,
            "strava_activity_id": str(activity["id"]),
            "activity_date": activity.get("start_date"),
            "distance_meters": distance_m,
            "duration_seconds": duration_s,
            "avg_pace_sec_per_km": avg_pace,
            "elevation_gain_meters": activity.get("total_elevation_gain"),
            "avg_heart_rate": activity.get("average_heartrate"),
            "max_heart_rate": activity.get("max_heartrate"),
            "avg_cadence": activity.get("average_cadence"),
            "workout_type": activity.get("type"),
            "raw_data": activity,
        }

        supabase.table("activities").upsert(row, on_conflict="strava_activity_id").execute()
        synced += 1

    compute_metrics(body.user_id)
    compute_risk_score(body.user_id)

    return {"synced": synced}


@router.get("/activities/{user_id}")
def get_activities(user_id: str):
    supabase = get_supabase()
    result = (
        supabase.table("activities")
        .select("*")
        .eq("user_id", user_id)
        .order("activity_date", desc=True)
        .execute()
    )
    return result.data or []
