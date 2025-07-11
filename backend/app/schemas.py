from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class QRPayload(BaseModel):
    employee_id: int = Field(..., examples=[123])
    timestamp: datetime
    signature: Optional[str] = None  # TODO: verify signature in future MVPs


class AttendanceRequest(BaseModel):
    qr: QRPayload
    image_b64: str  # base64-encoded face image captured by kiosk


class AttendanceResponse(BaseModel):
    employee_id: int
    checkin_time: Optional[datetime] = None
    checkout_time: Optional[datetime] = None
