from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class EmployeeBase(BaseModel):
    employee_id: str
    name: str

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeOut(EmployeeBase):
    id: int
    created_at: Optional[datetime]
    class Config:
        orm_mode = True

class AttendanceBase(BaseModel):
    employee_id: str
    checkin_time: Optional[datetime]
    checkout_time: Optional[datetime]
    verified: bool = False
    method: Optional[str]

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceOut(AttendanceBase):
    id: int
    created_at: Optional[datetime]
    class Config:
        orm_mode = True

class LogBase(BaseModel):
    request: dict
    response: dict
    image_hash: Optional[str]
    timestamp: Optional[datetime]

class LogOut(LogBase):
    id: int
    class Config:
        orm_mode = True 