import json
import io
import csv
import re
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from firebase_admin import firestore
from database import db
from auth_utils import verify_student_token
from config import GROQ_API_KEY, GEMINI_API_KEY

router = APIRouter(tags=["sessions"])

class SessionSaveRequest(BaseModel):
    studentId: str
    cefrLevel: str
    timestamp: str
    conversation: list
    feedback: object
    lessonId: str = None
    metricScores: list = None

class FeedbackRequest(BaseModel):
    conversation: list
    cefrLevel: str = "B1"
    lesson: dict = None

def _matches_objective(conversation: list, objective: str) -> bool:
    if not objective:
        return False
    user_text = " ".join([msg.get("text", "") for msg in conversation if msg.get("role") == "user"]).lower()
    if len(user_text) < 20:
        return False
    stop_words = {
        'and', 'the', 'to', 'a', 'an', 'of', 'for', 'in', 'on', 'at', 'with', 'is', 'are', 'be',
        'by', 'about', 'that', 'this', 'it', 'you', 'your', 'who', 'how', 'why', 'as', 'from',
        'or', 'new', 'very', 'can', 'must', 'should', 'will', 'would', 'could', 'their', 'they',
        'them', 'we', 'our', 'us', 'when', 'where', 'which', 'what', 'must', 'into', 'just', 'also'
    }
    objective_words = [w for w in re.findall(r"\w+", objective.lower()) if w not in stop_words and len(w) > 2]
    if not objective_words:
        return False
    unique_words = set(objective_words)
    matches = sum(1 for word in unique_words if word in user_text)
    required_matches = max(2, min(5, len(unique_words) // 2))
    return matches >= required_matches

def _build_fallback_feedback(conversation: list):
    user_answers = [msg.get("text", "") for msg in conversation if msg.get("role") == "user"]
    total_questions = len(user_answers)
    correct_count = total_questions if total_questions else 0
    percent = round((correct_count / total_questions) * 100) if total_questions else 0
    review = [
        {
            "answer": text,
            "status": "correct",
            "score": 1,
            "issue": "",
            "suggestion": "Nice clear response."
        }
        for text in user_answers
    ]
    metrics = []
    for name in ["Grammar", "Accuracy"]:
        metrics.append({
            "name": name,
            "percent": percent,
            "totalQuestions": total_questions,
            "correct": correct_count,
            "missing": max(total_questions - correct_count, 0),
            "review": review,
            "quickTip": "Use full basic patterns: subject + verb + object." if name == "Grammar" else "Answer the question directly and include the key details."
        })
    percents = [percent, percent]
    overall_score = round(sum(percents) / len(percents)) if percents else 0
    return {
        "summary": "Here is your speaking profile from the 4-minute assessment.",
        "metrics": metrics,
        "overallScore": overall_score
    }

def _normalize_feedback_report(raw_report: dict, conversation: list):
    metric_names = ["Grammar", "Accuracy"]
    user_answers = [msg.get("text", "") for msg in conversation if msg.get("role") == "user"]
    total_questions = len(user_answers)
    raw_metrics = raw_report.get("metrics", {}) if isinstance(raw_report, dict) else {}
    normalized_metrics = []

    for metric_name in metric_names:
        raw_items = raw_metrics.get(metric_name, [])
        if not isinstance(raw_items, list):
            raw_items = []

        review = []
        score_total = 0
        for idx, answer in enumerate(user_answers):
            raw_item = raw_items[idx] if idx < len(raw_items) and isinstance(raw_items[idx], dict) else {}
            raw_score = raw_item.get("score")
            if raw_score is None:
                raw_score = 1 if raw_item.get("correct") else 0
            try:
                score = float(raw_score)
            except (TypeError, ValueError):
                score = 0
            score = max(0, min(score, 1))
            score_total += score
            status = "correct" if score >= 0.75 else "partial" if score >= 0.35 else "missing"
            review.append({
                "answer": raw_item.get("answer") or answer,
                "status": status,
                "score": score,
                "issue": raw_item.get("issue") or "",
                "suggestion": raw_item.get("suggestion") or ""
            })

        percent = round((score_total / total_questions) * 100) if total_questions else 0
        normalized_metrics.append({
            "name": metric_name,
            "percent": percent,
            "totalQuestions": total_questions,
            "correct": round(score_total, 1),
            "missing": round(max(total_questions - score_total, 0), 1),
            "review": review,
            "quickTip": raw_report.get("quickTips", {}).get(metric_name, "Use full basic patterns: subject + verb + object." if metric_name == "Grammar" else "Answer the question directly and include the key details.") if isinstance(raw_report, dict) else ("Use full basic patterns: subject + verb + object." if metric_name == "Grammar" else "Answer the question directly and include the key details.")
        })

    percents = [m["percent"] for m in normalized_metrics if m["name"] in ["Grammar", "Accuracy"]]
    overall_score = round(sum(percents) / len(percents)) if percents else 0
    return {
        "summary": raw_report.get("summary", "Here is your speaking profile from the 4-minute assessment.") if isinstance(raw_report, dict) else "Here is your speaking profile from the 4-minute assessment.",
        "metrics": normalized_metrics,
        "overallScore": overall_score
    }

@router.post("/session/save")
async def save_session(req: SessionSaveRequest, current_student: str = Depends(verify_student_token)):
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    passed = False
    next_lesson = None
    level_complete = False
    
    if req.lessonId:
        lesson_doc = db.collection("curriculum").document(req.lessonId).get()
        if lesson_doc.exists:
            lesson_data = lesson_doc.to_dict()
            objective = lesson_data.get("objective")
            
            user_turns = len([msg for msg in req.conversation if msg['role'] == 'user'])
            if user_turns < 3:
                passed = False
            elif GROQ_API_KEY:
                try:
                    from groq import Groq
                    groq_client = Groq(api_key=GROQ_API_KEY)
                    
                    transcript = "\n".join([f"{msg['role']}: {msg['text']}" for msg in req.conversation])
                    eval_prompt = f"""You are a supportive language instructor. Review this English learning conversation and decide whether the student achieved the stated lesson objective.
Student Level: {req.cefrLevel}
Objective: {objective}

Conversation:
{transcript}

Assessment guidance:
1. For A1/A2, accept short or partially formed sentences as long as the student clearly attempts the objective in English.
2. Reward understandable responses and correct intent, not perfect grammar.
3. For B1/B2, focus on whether the student uses clear, relevant English to fulfill the objective.
4. Only answer NO when the response is unrelated, not in English, or does not satisfy the objective.

Answer ONLY with 'YES' or 'NO'. Do not provide any other text."""
                    
                    response = groq_client.chat.completions.create(
                        model="qwen/qwen3.8-27b",
                        messages=[{"role": "user", "content": eval_prompt}],
                        temperature=0.1,
                    )
                    
                    if "YES" in response.choices[0].message.content.upper():
                        passed = True
                except Exception as e:
                    print(f"Evaluation error: {e}")
                    if user_turns >= 4 and _matches_objective(req.conversation, objective):
                        passed = True
            else:
                if user_turns >= 4 and _matches_objective(req.conversation, objective):
                    passed = True

    grammar_percent = None
    accuracy_percent = None
    
    metric_scores = getattr(req, "metricScores", None)
    if metric_scores:
        for m in metric_scores:
            if isinstance(m, dict):
                name = m.get("name")
                percent = m.get("percent")
                if name == "Grammar":
                    grammar_percent = percent
                elif name == "Accuracy":
                    accuracy_percent = percent
                    
    if grammar_percent is None or accuracy_percent is None:
        try:
            fb = req.feedback
            if isinstance(fb, str):
                fb = json.loads(fb)
            if isinstance(fb, dict) and "metrics" in fb:
                for m in fb["metrics"]:
                    if isinstance(m, dict):
                        name = m.get("name")
                        percent = m.get("percent")
                        if name == "Grammar":
                            grammar_percent = percent
                        elif name == "Accuracy":
                            accuracy_percent = percent
        except Exception as e:
            print(f"Error parsing feedback for metrics: {e}")
            
    if grammar_percent is not None and accuracy_percent is not None:
        overall_score = (grammar_percent + accuracy_percent) / 2.0
    elif grammar_percent is not None:
        overall_score = grammar_percent
    elif accuracy_percent is not None:
        overall_score = accuracy_percent
    else:
        overall_score = 0.0

    if overall_score < 60:
        passed = False

    if passed:
        current_lesson_doc = db.collection("curriculum").document(req.lessonId).get()
        if current_lesson_doc.exists:
            current_data = current_lesson_doc.to_dict()
            current_order = current_data.get("order", 1)
            current_cefr = current_data.get("cefrLevel", req.cefrLevel)

            all_level_lessons = db.collection("curriculum").where("cefrLevel", "==", current_cefr).stream()
            candidates = []
            for doc in all_level_lessons:
                d = doc.to_dict()
                if d.get("order", 0) > current_order:
                    candidates.append(d)

            if candidates:
                candidates.sort(key=lambda x: x.get("order", 0))
                next_lesson = candidates[0]
                db.collection("students").document(req.studentId).update({
                    "currentLessonId": next_lesson["lessonId"]
                })

        if not next_lesson:
            level_complete = True

    session_data = req.model_dump()
    session_data["passed"] = passed
    session_data["overallScore"] = overall_score
    doc_ref = db.collection("sessions").document()
    doc_ref.set(session_data)
    
    update_data = {"practiceStreak": firestore.Increment(1)}
    if level_complete:
        update_data["levelComplete"] = True
    db.collection("students").document(req.studentId).update(update_data)
    
    return {
        "id": doc_ref.id, 
        "passed": passed, 
        "nextLesson": next_lesson,
        "levelComplete": level_complete
    }

@router.post("/feedback")
async def generate_feedback(req: FeedbackRequest, current_student: str = Depends(verify_student_token)):
    if not GROQ_API_KEY:
        report = _build_fallback_feedback(req.conversation)
        return {"feedback": json.dumps(report), "report": report}

    try:
        from groq import Groq
        groq_client = Groq(api_key=GROQ_API_KEY)
        
        formatted_convo = []
        answer_number = 0
        for msg in req.conversation:
            if msg['role'] == 'user':
                answer_number += 1
                formatted_convo.append(f"ANSWER {answer_number}: {msg['text']}")
            else:
                formatted_convo.append(f"COACH: {msg['text']}")
        full_conversation = "\n".join(formatted_convo)
        user_answer_count = answer_number
        lesson_objective = req.lesson.get("objective") if req.lesson else "General English speaking practice"
        
        prompt = f"""Analyze this English assessment conversation for a {req.cefrLevel} learner.
Lesson objective: {lesson_objective}

Return ONLY valid JSON. Do not include Markdown, comments, or prose outside the JSON.

There are exactly {user_answer_count} student answers. Treat each student answer as one answered question.
For Grammar and Accuracy, return exactly {user_answer_count} review objects in the same order as the answers.
Score each answer with "score": 0, 0.5, or 1.
Do not calculate percentages. The app will calculate each percentage from the average answer score.

Scoring rules:
- Be fair to spoken beginner/intermediate English. Ignore capitalization and punctuation.
- Grammar score 1 when the answer is understandable and mostly grammatical, even if it is short or has minor errors.
- Grammar score 0.5 when the meaning is clear but there is a noticeable grammar issue.
- Grammar score 0 only when grammar makes the answer hard to understand.
- Accuracy score 1 when the answer reasonably responds to the coach or moves the conversation forward.
- Accuracy score 0.5 when the answer is related or understandable but incomplete, awkward, or only partly responsive.
- Accuracy score 0 only when the answer is unrelated, empty, or impossible to connect to the conversation.
- Do not mark an answer wrong just because it is informal, brief, or not the best possible response.

CRITICAL feedback rules for "issue" and "suggestion" fields:
- When score = 1: set "issue" to "" and "suggestion" to "".
- When score = 0.5 or 0: you MUST fill BOTH fields.
  - "issue": a SHORT specific description of what was wrong (e.g. "Missing verb", "Wrong tense used", "Did not answer the question").
  - "suggestion": a FULL example of how the student SHOULD have said it (e.g. 'Try: "I would like to order a coffee, please."').
  - The suggestion must always include a model sentence starting with 'Try: "..."'.
  - Never leave issue or suggestion empty when the score is less than 1.

JSON shape:
{{
  "summary": "short friendly summary",
  "metrics": {{
    "Grammar": [{{"answer": "student answer", "score": 1, "issue": "", "suggestion": ""}}],
    "Accuracy": [{{"answer": "student answer", "score": 0.5, "issue": "Did not answer the question", "suggestion": "Try: \\"I went to the market yesterday.\\""}}]
  }},
  "quickTips": {{
    "Grammar": "one short tip",
    "Accuracy": "one short tip"
  }}
}}

Conversation:
{full_conversation}"""
        
        content = None
        for model_name in ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]:
            try:
                response = groq_client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                )
                content = response.choices[0].message.content.strip()
                break
            except Exception as me:
                print(f"Groq {model_name} feedback failed: {me}")
                continue

        if not content and GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=GEMINI_API_KEY)
                g_model = genai.GenerativeModel("gemini-2.5-flash")
                g_res = g_model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
                content = g_res.text.strip()
            except Exception as ge:
                print(f"Gemini feedback fallback failed: {ge}")

        if not content:
            raise Exception("No AI model available for feedback")

        if content.startswith("```"):
            content = content.strip("`")
            content = content.replace("json", "", 1).strip()
        raw_report = json.loads(content)
        report = _normalize_feedback_report(raw_report, req.conversation)
        return {"feedback": json.dumps(report), "report": report}
    except Exception as e:
        print("Groq Feedback Exception:", str(e))
        report = _build_fallback_feedback(req.conversation)
        return {"feedback": json.dumps(report), "report": report}

@router.get("/sessions")
async def get_sessions(studentId: str, current_student: str = Depends(verify_student_token)):
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    docs = db.collection("sessions").where("studentId", "==", studentId).stream()
    sessions = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        sessions.append(d)
    return {"sessions": sessions}

@router.get("/export")
async def export_sessions(current_student: str = Depends(verify_student_token)):
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    docs = db.collection("sessions").stream()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["studentId", "timestamp", "conversation", "feedback"])
    
    for doc in docs:
        d = doc.to_dict()
        writer.writerow([
            d.get("studentId"),
            d.get("timestamp"),
            json.dumps(d.get("conversation", [])),
            d.get("feedback")
        ])
    
    return PlainTextResponse(content=output.getvalue(), media_type="text/csv")
