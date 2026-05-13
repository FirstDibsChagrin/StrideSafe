from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routes.strava import router as strava_router

load_dotenv()

app = FastAPI(title="StrideSafe API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(strava_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
