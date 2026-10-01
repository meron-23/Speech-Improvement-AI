from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import db
from auth_utils import create_student_token

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    studentId: str

@router.post("/login")
async def login(req: LoginRequest):
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Verify student exists
    doc_ref = db.collection("students").document(req.studentId)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Student ID not recognized. Please check your ID and try again.")
    
    student_data = doc.to_dict()
    
    # Check if school is revoked
    school_id = student_data.get("schoolId")
    if school_id:
        school_doc = db.collection("schools").document(school_id).get()
        if school_doc.exists and school_doc.to_dict().get("status") == "REVOKED":
            raise HTTPException(status_code=403, detail="Your school's access has been revoked. Please contact your administrator.")
    
    # Generate signed JWT token for authentication
    token_str = create_student_token(req.studentId)

    # Fetch or Assign current lesson details
    lesson_id = student_data.get("currentLessonId")
    if not lesson_id:
        # Find first lesson for their CEFR level
        level = student_data.get("cefrLevel", "A1")
        lessons_query = db.collection("curriculum").where("cefrLevel", "==", level).stream()
        lessons_list = []
        for l_doc in lessons_query:
            lessons_list.append(l_doc.to_dict())
        lessons_list.sort(key=lambda x: x.get("order", 0))
        
        if lessons_list:
            lesson_id = lessons_list[0]["lessonId"]
        
        if not lesson_id:
            lesson_id = "l1_meeting" # Absolute fallback
            
        doc_ref.update({"currentLessonId": lesson_id})
        student_data["currentLessonId"] = lesson_id

    current_lesson = None
    lesson_doc = db.collection("curriculum").document(lesson_id).get()
    if lesson_doc.exists:
        current_lesson = lesson_doc.to_dict()

    return {
        "token": token_str,
        "student": {
            "studentId": req.studentId,
            "name": student_data.get("name"),
            "cefrLevel": student_data.get("cefrLevel"),
            "practiceStreak": student_data.get("practiceStreak", 0),
            "currentLesson": current_lesson,
            "levelComplete": student_data.get("levelComplete", False)
        }
    }
