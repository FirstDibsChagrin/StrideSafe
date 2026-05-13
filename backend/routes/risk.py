from fastapi import APIRouter
from pydantic import BaseModel

from services.risk import compute_risk_score

router = APIRouter(prefix="/risk", tags=["risk"])


class ComputeRequest(BaseModel):
    user_id: str


@router.post("/compute")
def compute_risk_endpoint(body: ComputeRequest):
    return compute_risk_score(body.user_id)
