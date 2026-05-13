import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.supabase import get_supabase_client

router = APIRouter(prefix="/strava", tags=["strava"])

_REDIRECT_URI = "http://localhost:3000/strava/callback"
_SCOPE = "read,activity:read_all"


@router.get("/auth")
def strava_auth():
    client_id = os.getenv("STRAVA_CLIENT_ID")
    url = (
        "https://www.strava.com/oauth/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={_SCOPE}"
    )
    return {"url": url}


class CallbackRequest(BaseModel):
    code: str
    user_id: str


@router.post("/callback")
async def strava_callback(body: CallbackRequest):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": os.getenv("STRAVA_CLIENT_ID"),
                "client_secret": os.getenv("STRAVA_CLIENT_SECRET"),
                "code": body.code,
                "grant_type": "authorization_code",
            },
        )

    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to exchange Strava auth code")

    tokens = response.json()

    supabase = get_supabase_client()
    supabase.table("strava_connections").upsert(
        {
            "user_id": body.user_id,
            "athlete_id": tokens["athlete"]["id"],
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "expires_at": tokens["expires_at"],
        },
        on_conflict="user_id",
    ).execute()

    return {"success": True}
