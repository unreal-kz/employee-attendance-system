from sqlalchemy import Column, Integer, String, TIMESTAMP, Boolean, ForeignKey, LargeBinary
from sqlalchemy.dialects.postgresql import JSONB
from .database import Base

class Employee(Base):
    __tablename__ = 'employees'
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(128), nullable=False)
    face_embedding = Column(LargeBinary)
    created_at = Column(TIMESTAMP)

class Attendance(Base):
    __tablename__ = 'attendance'
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(64), ForeignKey('employees.employee_id'))
    checkin_time = Column(TIMESTAMP)
    checkout_time = Column(TIMESTAMP)
    verified = Column(Boolean, default=False)
    method = Column(String(32))
    created_at = Column(TIMESTAMP)

class Log(Base):
    __tablename__ = 'logs'
    id = Column(Integer, primary_key=True, index=True)
    request = Column(JSONB)
    response = Column(JSONB)
    image_hash = Column(String(128))
    timestamp = Column(TIMESTAMP) 