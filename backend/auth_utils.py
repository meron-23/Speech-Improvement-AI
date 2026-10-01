import time
from typing import Optional
from fastapi import HTTPException, Header
import jwt
from config import JWT_SECRET

def create_student_token(student_id: str) -> str:
    payload = {
        "sub": student_id,
        "role": "student",
        "iat": int(time.time()),
        "exp": int(time.time()) + (86400 * 30)  # 30 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_student_token(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        student_id = payload.get("sub")
        if not student_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return student_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
