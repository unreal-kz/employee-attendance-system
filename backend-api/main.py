from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
import models, schemas, utils
from database import SessionLocal, engine
from datetime import datetime, date
from typing import List, Optional

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/employees", response_model=schemas.EmployeeOut)
def create_employee(employee: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    db_employee = db.query(models.Employee).filter(models.Employee.employee_id == employee.employee_id).first()
    if db_employee:
        raise HTTPException(status_code=400, detail="Employee already exists")
    new_employee = models.Employee(employee_id=employee.employee_id, name=employee.name, created_at=datetime.utcnow())
    db.add(new_employee)
    db.commit()
    db.refresh(new_employee)
    return new_employee

@app.post("/generate-qr")
def generate_qr(data: schemas.EmployeeBase):
    qr_data = utils.generate_qr_data(data.employee_id)
    return {"qr_data": qr_data}

@app.post("/validate-qr")
def validate_qr(qr: dict):
    qr_data = qr.get("qr_data")
    valid, result = utils.validate_qr_data(qr_data)
    if not valid:
        raise HTTPException(status_code=400, detail=result)
    return {"employee_id": result, "valid": True}

@app.get("/employees", response_model=List[schemas.EmployeeOut])
def list_employees(db: Session = Depends(get_db)):
    return db.query(models.Employee).all()

@app.get("/attendance", response_model=List[schemas.AttendanceOut])
def list_attendance(
    employee_id: Optional[str] = Query(None),
    day: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(models.Attendance)
    if employee_id:
        q = q.filter(models.Attendance.employee_id == employee_id)
    if day:
        try:
            day_dt = datetime.strptime(day, "%Y-%m-%d").date()
            q = q.filter(func.date(models.Attendance.created_at) == day_dt)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    return q.all()

@app.get("/attendance/{employee_id}", response_model=List[schemas.AttendanceOut])
def list_attendance_by_employee(employee_id: str, db: Session = Depends(get_db)):
    return db.query(models.Attendance).filter(models.Attendance.employee_id == employee_id).all()

# Update attendance endpoint to log events
@app.post("/attendance")
def mark_attendance(data: schemas.AttendanceCreate, db: Session = Depends(get_db)):
    employee = db.query(models.Employee).filter(models.Employee.employee_id == data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    today = date.today()
    attendance = db.query(models.Attendance).filter(
        models.Attendance.employee_id == data.employee_id,
        func.date(models.Attendance.created_at) == today
    ).first()
    now = datetime.utcnow()
    if not attendance:
        new_attendance = models.Attendance(
            employee_id=data.employee_id,
            checkin_time=now,
            verified=data.verified,
            method=data.method,
            created_at=now
        )
        db.add(new_attendance)
        db.commit()
        db.refresh(new_attendance)
        # Log event
        log = models.Log(request=data.dict(), response={"status": "checked_in"}, image_hash=None, timestamp=now)
        db.add(log)
        db.commit()
        return {"status": "checked_in", "attendance_id": new_attendance.id}
    elif attendance.checkin_time and not attendance.checkout_time:
        attendance.checkout_time = now
        db.commit()
        # Log event
        log = models.Log(request=data.dict(), response={"status": "checked_out"}, image_hash=None, timestamp=now)
        db.add(log)
        db.commit()
        return {"status": "checked_out", "attendance_id": attendance.id}
    else:
        # Log event
        log = models.Log(request=data.dict(), response={"status": "already_checked_out"}, image_hash=None, timestamp=now)
        db.add(log)
        db.commit()
        return {"status": "already_checked_out", "attendance_id": attendance.id} 