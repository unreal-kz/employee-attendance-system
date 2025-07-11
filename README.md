# Employee Attendance System (QR + Face Recognition)

## Overview
A secure, modern employee attendance system using QR code and face recognition. Employees scan a QR code (badge or phone), system verifies their face, and records check-in/out in a database. Admin dashboard for attendance management.

---

## Architecture

```
+---------+      +-------------------+      +---------------------+      +-------------+
| Kiosk   | ---> | Backend API       | ---> | Face Recognition    | ---> | PostgreSQL  |
| (React) |      | (FastAPI)         |      | Service (FastAPI)   |      | DB          |
+---------+      +-------------------+      +---------------------+      +-------------+
```

- **Frontend**: React app for QR scan, face capture, and admin dashboard
- **Backend API**: FastAPI for QR validation, attendance logic, DB
- **Face Recognition**: FastAPI microservice using InsightFace
- **Database**: PostgreSQL
- **Deployment**: Docker Compose

---

## Folder Structure

```
employee-attendance-system/
│
├── frontend/               # React client (kiosk + admin)
├── face-recognition-api/   # Python FastAPI + InsightFace
├── backend-api/            # Attendance logic and DB
├── db/                     # DB schema and init scripts
├── docker-compose.yml
└── README.md
```

---

## Quick Start (Development)

1. Clone repo
2. Install Docker & Docker Compose
3. Run: `docker-compose up --build`
4. Access:
   - Kiosk: http://localhost:3000
   - Admin: http://localhost:3000/admin
   - Backend API: http://localhost:8000
   - Face API: http://localhost:8001

---

## Components

### 1. Frontend (React)
- QR code scanner (webcam)
- Camera capture for face
- Result display
- Admin dashboard

### 2. Backend API (FastAPI)
- QR code generation/validation
- Attendance logic
- DB integration
- REST API for frontend

### 3. Face Recognition API (FastAPI)
- Receives face image + employee_id
- Compares embedding (InsightFace)
- Returns match result

### 4. Database (PostgreSQL)
- `employees`, `attendance`, `logs` tables

---

## Security
- QR tokens expire after 30s–1 min
- HTTPS endpoints (production)
- Face anti-spoofing (optional)
- Rate limiting

---

## Testing
- Unit tests for QR, face, and backend
- Integration tests for full pipeline

---

## License
MIT 

---

## Yandex Cloud Deployment Notes

- Set up a PostgreSQL instance and update `DATABASE_URL` in your `.env` file (see `backend-api/.env.example`).
- Set a strong `SECRET_KEY` in your environment.
- Expose only necessary ports (use a reverse proxy for production).
- Restrict CORS origins in production for security.
- Never commit real secrets to version control. 