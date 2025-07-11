from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict

app = FastAPI(title="Mock Face Recognition API", version="0.1.0")


class VerifyRequest(BaseModel):
    employee_id: int
    image_b64: str


class VerifyResponse(BaseModel):
    verified: bool
    score: float


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}


@app.post("/verify", response_model=VerifyResponse, tags=["verify"])
async def verify_face(_: VerifyRequest):
    """Mock verification: always returns verified true with score 1.0. Replace with real model later."""
    return VerifyResponse(verified=True, score=1.0)
