import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services.db import get_supabase
from services.metrics import compute_metrics
from services.risk import compute_risk_score

router = APIRouter(prefix="/strava", tags=["strava"])


# ── Manual sync ────────────────────────────────────────────────────────────────

class SyncRequest(BaseModel):
    user_id: str


async def _do_sync(user_id: str) -> int:
    """
    Core sync logic: refresh token if needed, fetch last 90 activities from
    Strava, upsert into activities table, then recompute metrics and risk.
    Returns the number of activities synced.
    Extracted so it can be called both from the manual endpoint and the
    background task triggered by the webhook.
    """
    supabase = get_supabase()

    result = (
        supabase.table("strava_connections")
        .select("*")
        .eq("user_id", user_id)
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
        ).eq("user_id", user_id).execute()

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
            "user_id": user_id,
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

    compute_metrics(user_id)
    compute_risk_score(user_id)
    return synced


@router.post("/sync")
async def sync_strava(body: SyncRequest):
    synced = await _do_sync(body.user_id)
    return {"synced": synced}


# ── Activities list ────────────────────────────────────────────────────────────

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


# ── Webhook verification (GET) ─────────────────────────────────────────────────

@router.get("/webhook")
def verify_webhook(
    hub_mode: str = Query(alias="hub.mode", default=""),
    hub_verify_token: str = Query(alias="hub.verify_token", default=""),
    hub_challenge: str = Query(alias="hub.challenge", default=""),
):
    """
    Strava sends this GET request when you register a webhook subscription.
    Respond with the challenge to prove ownership of the endpoint.
    Set STRAVA_WEBHOOK_VERIFY_TOKEN in your environment to any secret string,
    then supply the same value when registering the webhook with Strava.
    """
    expected = os.environ.get("STRAVA_WEBHOOK_VERIFY_TOKEN", "")
    if hub_mode == "subscribe" and hub_verify_token == expected:
        return {"hub.challenge": hub_challenge}
    return JSONResponse(status_code=403, content={"detail": "Forbidden"})


# ── Webhook event receiver (POST) ──────────────────────────────────────────────

def _sync_from_webhook(strava_athlete_id: int) -> None:
    """
    Background task: look up the app user by their Strava athlete ID and run
    the full sync + metrics + risk pipeline for them.
    Runs in a thread managed by FastAPI's BackgroundTasks so Strava receives
    a 200 immediately and is never blocked by our processing time.
    """
    import asyncio

    supabase = get_supabase()
    result = (
        supabase.table("strava_connections")
        .select("user_id")
        .eq("strava_athlete_id", strava_athlete_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        print(f"[webhook] No connection found for Strava athlete {strava_athlete_id}")
        return

    user_id = result.data[0]["user_id"]
    print(f"[webhook] Triggering sync for user {user_id} (athlete {strava_athlete_id})")
    try:
        asyncio.run(_do_sync(user_id))
        print(f"[webhook] Sync complete for user {user_id}")
    except Exception as exc:
        print(f"[webhook] Sync failed for user {user_id}: {exc}")


@router.post("/webhook")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Strava pushes a POST here whenever an athlete performs an action (new
    activity, update, delete, …).  We only act on activity-create events.
    Always returns 200 immediately — Strava requires a response within 2 s.
    """
    try:
        payload = await request.json()
    except Exception:
        # Malformed body — still return 200 so Strava doesn't retry
        return {"status": "ok"}

    object_type = payload.get("object_type")
    aspect_type = payload.get("aspect_type")
    owner_id    = payload.get("owner_id")  # Strava athlete ID

    if object_type == "activity" and aspect_type == "create" and owner_id:
        background_tasks.add_task(_sync_from_webhook, int(owner_id))

    return {"status": "ok"}
