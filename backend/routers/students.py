from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database import db
from auth_utils import verify_student_token

router = APIRouter(prefix="/student", tags=["students"])

class UpdateStudentRequest(BaseModel):
    studentId: str
    name: str = None
    cefrLevel: str = None

@router.post("/update")
async def update_student(req: UpdateStudentRequest, current_student: str = Depends(verify_student_token)):
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    doc_ref = db.collection("students").document(req.studentId)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Student not found")
        
    updates = {}
    if req.name is not None:
        updates["name"] = req.name
    if req.cefrLevel is not None:
        updates["cefrLevel"] = req.cefrLevel
        updates["levelComplete"] = False  # Reset levelComplete when transitioning to a new level
        
    if updates:
        doc_ref.update(updates)
        
    if req.cefrLevel is not None:
        lessons_query = db.collection("curriculum").where("cefrLevel", "==", req.cefrLevel).stream()
        lessons_list = []
        for l_doc in lessons_query:
            lessons_list.append(l_doc.to_dict())
        lessons_list.sort(key=lambda x: x.get("order", 0))
        if lessons_list:
            new_lesson_id = lessons_list[0]["lessonId"]
            doc_ref.update({"currentLessonId": new_lesson_id})
            
    updated_doc = doc_ref.get().to_dict()
    current_lesson = None
    lesson_id = updated_doc.get("currentLessonId")
    if lesson_id:
        lesson_doc = db.collection("curriculum").document(lesson_id).get()
        if lesson_doc.exists:
            current_lesson = lesson_doc.to_dict()
            
    return {
        "student": {
            "studentId": req.studentId,
            "name": updated_doc.get("name"),
            "cefrLevel": updated_doc.get("cefrLevel"),
            "practiceStreak": updated_doc.get("practiceStreak", 0),
            "currentLesson": current_lesson,
            "levelComplete": updated_doc.get("levelComplete", False)
        }
    }

@router.get("/{student_id}")
async def get_student(student_id: str, current_student: str = Depends(verify_student_token)):
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    doc_ref = db.collection("students").document(student_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Student not found")
        
    student_data = doc.to_dict()
    
    lesson_id = student_data.get("currentLessonId")
    current_lesson = None
    if lesson_id:
        lesson_doc = db.collection("curriculum").document(lesson_id).get()
        if lesson_doc.exists:
            current_lesson = lesson_doc.to_dict()
            
    return {
        "student": {
            "studentId": student_id,
            "name": student_data.get("name"),
            "cefrLevel": student_data.get("cefrLevel"),
            "practiceStreak": student_data.get("practiceStreak", 0),
            "currentLesson": current_lesson,
            "levelComplete": student_data.get("levelComplete", False)
        }
    }
