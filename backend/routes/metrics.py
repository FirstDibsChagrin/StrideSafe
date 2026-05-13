from fastapi import APIRouter
from pydantic import BaseModel

from services.metrics import compute_metrics

router = APIRouter(prefix="/metrics", tags=["metrics"])


class ComputeRequest(BaseModel):
    user_id: str


@router.post("/compute")
def compute_metrics_endpoint(body: ComputeRequest):
    return compute_metrics(body.user_id)
