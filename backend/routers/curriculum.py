from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth_utils import verify_student_token

router = APIRouter(tags=["curriculum"])

@router.get("/lessons")
async def get_lessons(level: str = None, current_student: str = Depends(verify_student_token)):
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    query = db.collection("curriculum")
    if level:
        query = query.where("cefrLevel", "==", level)
    
    docs = query.stream()
    lessons = []
    for doc in docs:
        d = doc.to_dict()
        lessons.append(d)
    
    lessons.sort(key=lambda x: x.get("order", 0))
    return {"lessons": lessons}
