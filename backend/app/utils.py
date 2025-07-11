from datetime import datetime, timezone, date
from sqlalchemy.orm import Session
from . import models


def mark_attendance(db: Session, employee_id: int) -> models.Attendance:
    """If the employee has no record for today, create one and set check-in.
    If they already checked in but not checked out, set checkout_time.
    Returns the updated/created Attendance row.
    """
    today = date.today()

    attendance = (
        db.query(models.Attendance)
        .filter(models.Attendance.employee_id == employee_id)
        .filter(models.Attendance.checkin_time >= datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc))
        .order_by(models.Attendance.id.desc())
        .first()
    )

    if attendance is None:
        attendance = models.Attendance(
            employee_id=employee_id,
            checkin_time=datetime.now(timezone.utc),
        )
        db.add(attendance)
    elif attendance.checkout_time is None:
        attendance.checkout_time = datetime.now(timezone.utc)
    # else: already checked out; keep unchanged

    db.commit()
    db.refresh(attendance)
    return attendance
