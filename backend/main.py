from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.strava import router as strava_router
from routes.metrics import router as metrics_router
from routes.risk import router as risk_router

app = FastAPI(title="StrideSafe API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(strava_router)
app.include_router(metrics_router)
app.include_router(risk_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
