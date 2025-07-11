from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel

app = FastAPI()

class FaceVerifyResponse(BaseModel):
    verified: bool
    similarity: float

@app.post("/verify-face", response_model=FaceVerifyResponse)
def verify_face(employee_id: str = Form(...), image: UploadFile = File(...)):
    # TODO: Run face detection, extract embedding, compare to DB
    # Placeholder: always return verified
    return {"verified": True, "similarity": 0.99} 