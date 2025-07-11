from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models, schemas, database, utils
import httpx
import os

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


@app.post("/attendance/check", response_model=schemas.AttendanceResponse, tags=["attendance"])
async def check_attendance(payload: schemas.AttendanceRequest, db: Session = Depends(get_db)):
    """Entry point for kiosk. Accepts QR payload + base64 image; verifies face via microservice and
    registers check-in/out depending on today's state.
    """

    # 1. (MVP) Basic QR validation – just parse employee_id. TODO: verify signature & expiry
    employee_id = payload.qr.employee_id

    # 2. Verify face via microservice
    face_service_url = os.getenv("FACE_SERVICE_URL", "http://face-recognition-api:8001/verify")
    async with httpx.AsyncClient(timeout=5) as client:
        try:
            resp = await client.post(face_service_url, json={"employee_id": employee_id, "image_b64": payload.image_b64})
            resp.raise_for_status()
        except (httpx.HTTPError, httpx.TimeoutException) as err:
            raise HTTPException(status_code=502, detail=f"Face service error: {err}")
        data = resp.json()
    if not data.get("verified", False):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Face verification failed")

    # 3. Upsert attendance record for today
    attendance = utils.mark_attendance(db, employee_id)

    return schemas.AttendanceResponse(
        employee_id=employee_id,
        checkin_time=attendance.checkin_time,
        checkout_time=attendance.checkout_time,
    )
