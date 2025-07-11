from fastapi import FastAPI, Depends, HTTPException, status, Response, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from . import models, schemas, database, utils
import httpx
import os
import qrcode
import io
import base64
import uuid
from datetime import datetime, timezone
from typing import List

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Attendance Backend API", version="0.1.0")

# Allow kiosk / admin UI origins in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency for DB session

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok"}


def generate_qr_code(data: str) -> str:
    """Generate a base64-encoded QR code image."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode()


def parse_employee_id(qr_data: str) -> int:
    """Extract employee ID from QR code content.
    
    Expected format: 'emp_123' where 123 is the employee ID.
    """
    try:
        prefix, emp_id = qr_data.split('_')
        if prefix != 'emp':
            raise ValueError("Invalid QR code format")
        return int(emp_id)
    except (ValueError, AttributeError) as e:
        raise HTTPException(
            status_code=400,
            detail="Invalid QR code format. Expected format: 'emp_<employee_id>'"
        )


@app.get("/employees/{employee_id}/qr", tags=["employees"])
async def get_employee_qr(employee_id: int, db: Session = Depends(get_db)):
    """Generate a static QR code for an employee's badge.
    
    The QR code will contain the employee ID in the format 'emp_<id>'.
    This is a static QR that can be printed on an employee badge.
    """
    # Verify employee exists
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Simple static format: 'emp_<employee_id>'
    qr_content = f"emp_{employee.id}"
    qr_img_base64 = generate_qr_code(qr_content)
    
    return {
        "employee_id": employee.id,
        "name": employee.name,
        "qr_code": f"data:image/png;base64,{qr_img_base64}",
        "qr_content": qr_content,  # For debugging/verification
        "created_at": employee.created_at
    }


# ===== Employee Management =====

@app.post("/employees/", response_model=schemas.EmployeeResponse, status_code=status.HTTP_201_CREATED, tags=["employees"])
async def create_employee(employee: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    """Create a new employee (for testing/onboarding)."""
    try:
        # In a real app, you'd generate/store face embeddings here
        db_employee = models.Employee(
            name=employee.name,
            # Add other fields as needed
        )
        db.add(db_employee)
        db.commit()
        db.refresh(db_employee)
        return db_employee
    except Exception as e:
        db.rollback()
        print(f"Error creating employee: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create employee"
        )


@app.get("/employees/", response_model=List[schemas.EmployeeResponse], tags=["employees"])
async def list_employees(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all employees (for admin/testing)."""
    employees = db.query(models.Employee).offset(skip).limit(limit).all()
    return employees


# ===== Attendance Endpoints =====

@app.post("/attendance/check", response_model=schemas.AttendanceResponse, tags=["attendance"])
async def check_attendance(payload: schemas.AttendanceRequest, db: Session = Depends(get_db)):
    """Entry point for kiosk. 
    
    Expects:
    - qr_content: String from QR code (format: 'emp_<employee_id>')
    - image_b64: Base64-encoded face image from camera
    
    Verifies face matches the employee's stored face and registers check-in/out.
    """
    # 1. Parse employee ID from QR content
    try:
        employee_id = parse_employee_id(payload.qr_content)
    except HTTPException as e:
        # Log failed QR scan attempt
        print(f"Invalid QR scan attempt: {payload.qr_content}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid employee badge. Please try again or contact HR."
        )
    
    # 2. Get employee details
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found. Please contact HR to verify your badge."
        )
    
    # 3. Verify face via microservice
    face_service_url = os.getenv("FACE_SERVICE_URL", "http://face-recognition-api:8001/verify")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                face_service_url, 
                json={"employee_id": employee_id, "image_b64": payload.image_b64},
                timeout=10.0
            )
            resp.raise_for_status()
            data = resp.json()
            
            if not data.get("verified", False):
                # Log failed face verification
                print(f"Face verification failed for employee {employee_id}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Face verification failed. Please try again or contact HR if the issue persists."
                )
                
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Face verification service is not responding. Please try again later."
        )
    except httpx.HTTPError as err:
        print(f"Face service error: {err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to verify identity at this time. Please try again later."
        )

    # 4. Record attendance
    try:
        attendance = utils.mark_attendance(db, employee_id)
        db.refresh(attendance)
        
        # Determine status message
        if attendance.checkin_time and attendance.checkout_time:
            status_msg = "checked_out"
        elif attendance.checkin_time:
            status_msg = "checked_in"
        else:
            status_msg = "unknown"
            
        return schemas.AttendanceResponse(
            employee_id=employee.id,
            employee_name=employee.name,
            checkin_time=attendance.checkin_time,
            checkout_time=attendance.checkout_time,
            status=status_msg
        )
        
    except Exception as e:
        db.rollback()
        print(f"Error recording attendance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record attendance. Please try again."
        )
