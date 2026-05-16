from dotenv import load_dotenv

load_dotenv()

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.strava import auth_router, router as strava_router
from routes.metrics import router as metrics_router
from routes.risk import router as risk_router

app = FastAPI(title="StrideSafe API", version="0.1.0")

_frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(strava_router)
app.include_router(metrics_router)
app.include_router(risk_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
