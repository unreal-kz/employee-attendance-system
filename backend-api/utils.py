import hmac
import hashlib
import base64
import json
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")

# Generate QR data with HMAC signature

def generate_qr_data(employee_id: str, secret: str = SECRET_KEY):
    timestamp = datetime.utcnow().isoformat()
    payload = {
        "employee_id": employee_id,
        "timestamp": timestamp
    }
    payload_json = json.dumps(payload, separators=(",", ":"))
    signature = hmac.new(secret.encode(), payload_json.encode(), hashlib.sha256).hexdigest()
    qr_data = {
        **payload,
        "signature": signature
    }
    return base64.urlsafe_b64encode(json.dumps(qr_data).encode()).decode()

# Validate QR data and signature

def validate_qr_data(qr_data: str, secret: str = SECRET_KEY, max_age_sec: int = 60):
    try:
        decoded = base64.urlsafe_b64decode(qr_data.encode()).decode()
        data = json.loads(decoded)
        signature = data.pop("signature", None)
        payload_json = json.dumps(data, separators=(",", ":"))
        expected_sig = hmac.new(secret.encode(), payload_json.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return False, "Invalid signature"
        # Check timestamp
        ts = datetime.fromisoformat(data["timestamp"])
        if datetime.utcnow() - ts > timedelta(seconds=max_age_sec):
            return False, "QR expired"
        return True, data["employee_id"]
    except Exception as e:
        return False, str(e) 