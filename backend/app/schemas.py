from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, HttpUrl


class EmployeeCreate(BaseModel):
    """Schema for creating a new employee."""
    name: str = Field(..., min_length=2, max_length=100, example="John Doe")
    # In a real app, you'd include face_embedding here


class EmployeeResponse(EmployeeCreate):
    """Schema for employee responses (includes ID)."""
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AttendanceRequest(BaseModel):
    """Schema for attendance check-in/out requests.
    
    - qr_content: The raw string from the QR code (format: 'emp_<employee_id>')
    - image_b64: Base64-encoded face image from the kiosk camera
    """
    qr_content: str = Field(..., example="emp_123")
    image_b64: str  # base64-encoded face image captured by kiosk


class AttendanceResponse(BaseModel):
    """Schema for attendance responses."""
    employee_id: int
    employee_name: str
    checkin_time: Optional[datetime] = None
    checkout_time: Optional[datetime] = None
    status: str  # e.g., "checked_in", "checked_out"
