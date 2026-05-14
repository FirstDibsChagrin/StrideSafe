import asyncio
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel

from services.db import get_supabase
from services.metrics import compute_metrics
from services.risk import compute_risk_score

router = APIRouter(prefix="/strava", tags=["strava"])

STRAVA_CLIENT_ID = os.environ.get("STRAVA_CLIENT_ID", "")
STRAVA_CLIENT_SECRET = os.environ.get("STRAVA_CLIENT_SECRET", "")
STRAVA_REDIRECT_URI = os.environ.get("STRAVA_REDIRECT_URI", "")
STRAVA_WEBHOOK_VERIFY_TOKEN = os.environ.get("STRAVA_WEBHOOK_VERIFY_TOKEN", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")


# ── OAuth: initiate ───────────────────────────────────────────────────────────

@router.get("/connect")
def strava_connect(user_id: str = Query(...)):
    auth_url = (
        "https://www.strava.com/oauth/authorize"
        f"?client_id={STRAVA_CLIENT_ID}"
        f"&redirect_uri={STRAVA_REDIRECT_URI}"
        "&response_type=code"
        "&scope=activity:read_all"
        f"&state={user_id}"
    )
    return RedirectResponse(url=auth_url)


# ── OAuth: callback ───────────────────────────────────────────────────────────

@router.get("/callback")
async def strava_callback(
    code: str = Query(default=""),
    state: str = Query(default=""),
    error: str = Query(default=""),
):
    if error or not code or not state:
        return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?strava=error")

    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://www.strava.com/oauth/token",
                data={
                    "client_id": STRAVA_CLIENT_ID,
                    "client_secret": STRAVA_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                },
                timeout=15.0,
            )
        if token_resp.status_code != 200:
            return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?strava=error")

        token_data = token_resp.json()
        athlete = token_data.get("athlete", {})
        expires_at = int(datetime.now(timezone.utc).timestamp()) + int(
            token_data.get("expires_in", 21600)
        )

        supabase = get_supabase()
        supabase.table("strava_connections").upsert(
            {
                "user_id": state,
                "strava_athlete_id": athlete.get("id"),
                "access_token": token_data["access_token"],
                "refresh_token": token_data["refresh_token"],
                "token_expires_at": expires_at,
            },
            on_conflict="user_id",
        ).execute()

    except Exception:
        return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?strava=error")

    return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?strava=connected")


# ── Webhook: verification ─────────────────────────────────────────────────────

@router.get("/webhook")
def verify_webhook(
    hub_mode: str = Query(alias="hub.mode", default=""),
    hub_verify_token: str = Query(alias="hub.verify_token", default=""),
    hub_challenge: str = Query(alias="hub.challenge", default=""),
):
    if hub_mode == "subscribe" and hub_verify_token == STRAVA_WEBHOOK_VERIFY_TOKEN:
        return {"hub.challenge": hub_challenge}
    return JSONResponse(status_code=403, content={"detail": "Forbidden"})


# ── Webhook: event receiver ───────────────────────────────────────────────────

class WebhookEvent(BaseModel):
    object_type: str = ""
    aspect_type: str = ""
    object_id: int = 0
    owner_id: int = 0


@router.post("/webhook")
async def receive_webhook(event: WebhookEvent, background_tasks: BackgroundTasks):
    if event.object_type == "activity" and event.aspect_type == "create":
        background_tasks.add_task(_sync_from_webhook, event.owner_id)
    return {"status": "ok"}


async def _sync_from_webhook(strava_athlete_id: int):
    supabase = get_supabase()
    result = (
        supabase.table("strava_connections")
        .select("user_id")
        .eq("strava_athlete_id", strava_athlete_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        return
    user_id = result.data[0]["user_id"]
    await _do_sync(user_id)


# ── Shared sync logic ─────────────────────────────────────────────────────────

async def _do_sync(user_id: str) -> int:
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
    expires_at = conn.get("token_expires_at") or conn.get("expires_at")

    now_ts = datetime.now(timezone.utc).timestamp()
    if expires_at and now_ts >= float(expires_at):
        async with httpx.AsyncClient() as client:
            refresh_resp = await client.post(
                "https://www.strava.com/oauth/token",
                data={
                    "client_id": STRAVA_CLIENT_ID,
                    "client_secret": STRAVA_CLIENT_SECRET,
                    "grant_type": "refresh_token",
                    "refresh_token": conn["refresh_token"],
                },
                timeout=15.0,
            )
        if refresh_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to refresh Strava token")
        token_data = refresh_resp.json()
        access_token = token_data["access_token"]
        new_expires_at = int(datetime.now(timezone.utc).timestamp()) + int(
            token_data.get("expires_in", 21600)
        )
        supabase.table("strava_connections").update(
            {
                "access_token": access_token,
                "refresh_token": token_data["refresh_token"],
                "token_expires_at": new_expires_at,
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


# ── Manual sync endpoint ──────────────────────────────────────────────────────

class SyncRequest(BaseModel):
    user_id: str


@router.post("/sync")
async def sync_strava(body: SyncRequest):
    synced = await _do_sync(body.user_id)
    return {"synced": synced}


# ── Activities list ───────────────────────────────────────────────────────────

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
