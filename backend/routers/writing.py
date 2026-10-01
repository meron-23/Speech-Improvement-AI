import os
import json
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from database import db
from auth_utils import verify_student_token
from config import GROQ_API_KEY, GEMINI_API_KEY

router = APIRouter(prefix="/writing", tags=["writing"])

# --- Request / Response Models ---

class WritingAssessRequest(BaseModel):
    text: str
    promptId: Optional[str] = None
    promptTitle: Optional[str] = None
    promptCategory: Optional[str] = None
    cefrLevel: str = "B1"

class WritingSaveRequest(BaseModel):
    studentId: str
    promptId: Optional[str] = None
    promptTitle: Optional[str] = None
    promptCategory: Optional[str] = None
    text: str
    wordCount: int
    overallScore: int
    cefrLevel: str
    assessment: Dict[str, Any]
    timestamp: Optional[str] = None

class WritingPromptCreateRequest(BaseModel):
    id: Optional[str] = None
    level: str
    category: str
    title: str
    instructions: str
    targetWords: str = "80 - 150 words"
    minWords: int = 40
    keywords: List[str] = []
    order: Optional[int] = 99

# --- Default Seed Prompts (Synced to Firestore 'writing_prompts') ---

DEFAULT_WRITING_PROMPTS = [
    # A1 - Beginner
    {
        "id": "a1-daily-routine",
        "level": "A1",
        "category": "Daily Life",
        "title": "My Daily Routine",
        "instructions": "Describe what you usually do every day from morning until night. Write about your wake-up time, meals, and favorite activities.",
        "targetWords": "50 - 100 words",
        "minWords": 30,
        "keywords": ["morning", "breakfast", "school / work", "evening", "sleep"]
    },
    {
        "id": "a1-favorite-food",
        "level": "A1",
        "category": "Daily Life",
        "title": "My Favorite Food",
        "instructions": "What is your favorite dish or food? Describe what it tastes like, when you eat it, and why you love it.",
        "targetWords": "40 - 80 words",
        "minWords": 25,
        "keywords": ["delicious", "cook", "ingredients", "family", "taste"]
    },
    {
        "id": "a1-best-friend",
        "level": "A1",
        "category": "Storytelling",
        "title": "My Best Friend",
        "instructions": "Introduce your best friend. What do they look like? What is their personality, and what do you like doing together?",
        "targetWords": "50 - 100 words",
        "minWords": 30,
        "keywords": ["kind", "funny", "together", "hobbies", "friendship"]
    },

    # A2 - Elementary
    {
        "id": "a2-last-vacation",
        "level": "A2",
        "category": "Storytelling",
        "title": "A Memorable Vacation or Trip",
        "instructions": "Write about a trip or vacation you took in the past. Where did you go, who did you go with, and what was the most exciting thing that happened?",
        "targetWords": "80 - 150 words",
        "minWords": 50,
        "keywords": ["traveled", "visited", "weather", "memorable", "experience"]
    },
    {
        "id": "a2-invitation-email",
        "level": "A2",
        "category": "Workplace & Emails",
        "title": "Inviting a Friend to a Celebration",
        "instructions": "Write a friendly email inviting someone to your birthday party or a holiday celebration. Include date, time, location, and activities.",
        "targetWords": "70 - 120 words",
        "minWords": 40,
        "keywords": ["celebrate", "party", "location", "join us", "hope to see you"]
    },
    {
        "id": "a2-why-learn-english",
        "level": "A2",
        "category": "Reflective",
        "title": "Why I Am Learning English",
        "instructions": "Explain your personal goals for learning English. How will speaking and writing in English help your future, studies, or career?",
        "targetWords": "80 - 140 words",
        "minWords": 50,
        "keywords": ["goals", "future", "opportunity", "practice", "communicate"]
    },

    # B1 - Intermediate
    {
        "id": "b1-school-homework",
        "level": "B1",
        "category": "Opinion & Debates",
        "title": "Should Homework Be Banned?",
        "instructions": "Argue whether school students should receive daily homework or if learning should stay strictly in the classroom. Provide reasons for both sides and conclude with your opinion.",
        "targetWords": "120 - 220 words",
        "minWords": 80,
        "keywords": ["academic", "pressure", "independent learning", "balance", "conclusion"]
    },
    {
        "id": "b1-hotel-complaint",
        "level": "B1",
        "category": "Workplace & Emails",
        "title": "Formal Email to a Hotel Manager",
        "instructions": "Write a polite but firm formal email complaining about unexpected problems during a recent hotel stay (e.g. noisy air conditioner, missing reservations) and request compensation or a refund.",
        "targetWords": "120 - 200 words",
        "minWords": 70,
        "keywords": ["disappointed", "inconvenience", "resolution", "regards", "assistance"]
    },
    {
        "id": "b1-dream-career",
        "level": "B1",
        "category": "Reflective",
        "title": "My Dream Career & Impact",
        "instructions": "Describe the career or profession you aspire to pursue. What skills do you need to develop, and how will your work benefit your community or the world?",
        "targetWords": "130 - 220 words",
        "minWords": 80,
        "keywords": ["aspiration", "skills", "community", "passion", "dedication"]
    },

    # B2 - Upper Intermediate
    {
        "id": "b2-remote-work",
        "level": "B2",
        "category": "Opinion & Debates",
        "title": "Remote Work vs. Traditional Office",
        "instructions": "Analyze the shift towards remote and hybrid work. Discuss productivity, psychological well-being, and social isolation. Give your perspective on the future of work.",
        "targetWords": "180 - 300 words",
        "minWords": 120,
        "keywords": ["productivity", "flexibility", "isolation", "collaboration", "work-life balance"]
    },
    {
        "id": "b2-social-media-impact",
        "level": "B2",
        "category": "Opinion & Debates",
        "title": "The Impact of Social Media on Modern Youth",
        "instructions": "Evaluate whether social media platforms foster genuine human connection or contribute to loneliness and unrealistic standards. Present balanced arguments supported by examples.",
        "targetWords": "180 - 300 words",
        "minWords": 120,
        "keywords": ["connectivity", "mental health", "superficial", "algorithms", "perspective"]
    },
    {
        "id": "b2-job-application-cover-letter",
        "level": "B2",
        "category": "Workplace & Emails",
        "title": "Professional Cover Letter",
        "instructions": "Draft a compelling cover letter applying for a leadership or technical role at an international organization. Highlight your key accomplishments, leadership style, and enthusiasm.",
        "targetWords": "180 - 280 words",
        "minWords": 110,
        "keywords": ["leadership", "qualifications", "contribution", "initiative", "sincerely"]
    },

    # C1 / C2 - Advanced
    {
        "id": "c1-ai-ethics",
        "level": "C1",
        "category": "Opinion & Debates",
        "title": "Can AI Replicate Human Creativity?",
        "instructions": "Critically analyze whether generative artificial intelligence can produce authentic art, literature, and philosophical insights, or whether true creativity requires human consciousness and emotional depth.",
        "targetWords": "250 - 450 words",
        "minWords": 150,
        "keywords": ["authenticity", "consciousness", "algorithmic", "nuance", "aesthetic"]
    },
    {
        "id": "c1-educational-reform-proposal",
        "level": "C1",
        "category": "Workplace & Emails",
        "title": "Policy Proposal for Educational Reform",
        "instructions": "Write an executive policy memo proposing systematic changes to secondary education to better equip students for the 21st-century technological economy. Propose actionable solutions.",
        "targetWords": "250 - 450 words",
        "minWords": 150,
        "keywords": ["pedagogical", "curriculum", "critical thinking", "implementation", "strategic"]
    }
]

# --- Prompt System Setup for LLM Evaluator ---

ASSESSMENT_SYSTEM_PROMPT = """You are an elite Cambridge/IELTS certified English writing assessor and CEFR examiner.
Your task is to thoroughly assess the student's writing submission across standard CEFR criteria:
1. Overall score (0-100) and estimated CEFR level (A1, A2, B1, B2, C1, C2).
2. Grammar & Syntax: Tenses, verb agreements, word order, complex structures.
3. Spelling & Punctuation: Typographical precision, capitalization, comma usage, apostrophes.
4. Vocabulary & Lexical Diversity: Range, repetitive words, idiomatic expressions, precision.
5. Coherence, Cohesion & Flow: Paragraphing, transition words, logical progression.
6. Task Fulfillment: How well the response answers the prompt instructions and maintains appropriate tone.

CRITICAL RULES:
- Return ONLY valid JSON. No markdown backticks, no commentary outside the JSON.
- Every detected issue MUST contain:
  - "type": "grammar" | "spelling" | "punctuation" | "word_choice" | "structure"
  - "original": the exact snippet from student text
  - "correction": the proper English replacement
  - "explanation": a concise, friendly explanation teaching the rule
- Provide up to 4 high-value "vocabularyEnhancements" replacing basic words with CEFR-level vocabulary.
- Provide a full "improvedVersion": a natural, high-level rewrite that preserves the student's authentic meaning and voice.
- Ensure all scores are numbers between 0 and 100.

JSON SCHEMA:
{
  "overallScore": 82,
  "cefrLevel": "B2",
  "feedbackSummary": "Clear, well-reasoned essay. Strong paragraph transitions with minor verb tense slips.",
  "metrics": {
    "grammar": {"score": 80, "label": "Strong", "feedback": "Good sentence variety with slight tense inconsistencies."},
    "spelling": {"score": 92, "label": "Excellent", "feedback": "Virtually flawless spelling."},
    "vocabulary": {"score": 78, "label": "Good", "feedback": "Appropriate lexical choice; could benefit from more precise academic terms."},
    "coherence": {"score": 85, "label": "Strong", "feedback": "Ideas flow smoothly with effective linking phrases."},
    "taskRelevance": {"score": 88, "label": "Strong", "feedback": "Prompt objectives fully satisfied."}
  },
  "issues": [
    {
      "type": "grammar",
      "original": "exact student snippet",
      "correction": "corrected snippet",
      "explanation": "educational rule explanation"
    }
  ],
  "vocabularyEnhancements": [
    {
      "original": "good idea",
      "suggestions": ["compelling concept", "pragmatic approach", "effective strategy"],
      "context": "Elevates informal phrasing to formal register."
    }
  ],
  "strengths": [
    "Compelling opening argument.",
    "Good use of transition markers."
  ],
  "nextSteps": [
    "Ensure consistent past tense in narrative sections.",
    "Vary sentence openings instead of repeating 'Also'."
  ],
  "improvedVersion": "A beautifully written, fluent native-level revision that keeps the student's ideas intact."
}
"""

def _clean_json_response(raw_text: str) -> dict:
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = cleaned.strip()
    return json.loads(cleaned)

def _heuristic_fallback_assessment(text: str, cefr_target: str = "B1") -> dict:
    """Robust local fallback in case external AI APIs are temporarily unreachable."""
    words = re.findall(r"\b\w+\b", text)
    word_count = len(words)
    sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    sentence_count = max(len(sentences), 1)
    avg_sentence_len = word_count / sentence_count

    # Common basic checks
    common_typos = {
        "teh": "the", "recieve": "receive", "definately": "definitely",
        "seperate": "separate", "untill": "until", "occured": "occurred",
        "truely": "truly", "alot": "a lot"
    }
    issues = []
    lower_text = text.lower()
    for typo, correction in common_typos.items():
        if re.search(r"\b" + typo + r"\b", lower_text):
            issues.append({
                "type": "spelling",
                "original": typo,
                "correction": correction,
                "explanation": f"The correct spelling is '{correction}'."
            })

    # Subject-verb agreement basic pattern check
    if re.search(r"\b(he|she|it)\s+(have|do|go)\b", lower_text):
        match = re.search(r"\b(he|she|it)\s+(have|do|go)\b", lower_text)
        if match:
            orig = match.group(0)
            corr = orig.replace("have", "has").replace("do", "does").replace("go", "goes")
            issues.append({
                "type": "grammar",
                "original": orig,
                "correction": corr,
                "explanation": "Third-person singular subjects (he/she/it) require singular verb forms."
            })

    base_score = min(90, max(50, 60 + min(word_count // 5, 25) - len(issues) * 5))
    
    return {
        "overallScore": base_score,
        "cefrLevel": cefr_target,
        "feedbackSummary": f"Your submission of {word_count} words demonstrates solid effort with clear expression of thought. Review the highlighted corrections to refine your accuracy.",
        "metrics": {
            "grammar": {"score": max(55, base_score - 3), "label": "Good", "feedback": "Consistent sentence flow throughout."},
            "spelling": {"score": max(60, 95 - len(issues) * 10), "label": "Strong", "feedback": "Accurate everyday orthography."},
            "vocabulary": {"score": min(85, max(60, 65 + word_count // 10)), "label": "Good", "feedback": "Diverse functional vocabulary."},
            "coherence": {"score": min(85, max(60, 70 + sentence_count * 2)), "label": "Good", "feedback": "Logical sequence between thoughts."},
            "taskRelevance": {"score": min(90, max(70, base_score + 5)), "label": "Strong", "feedback": "Directly responds to writing prompt."}
        },
        "issues": issues,
        "vocabularyEnhancements": [
            {
                "original": "good",
                "suggestions": ["effective", "commendable", "beneficial"],
                "context": "Provides greater nuance and expressive variety."
            }
        ],
        "strengths": [
            f"Wrote a clear composition containing {word_count} words.",
            "Expressed core ideas in an understandable structure."
        ],
        "nextSteps": [
            "Practice reading your sentences aloud to check rhythm and punctuation.",
            "Expand your use of transition words like 'Furthermore', 'Consequently', and 'In contrast'."
        ],
        "improvedVersion": text
    }

# --- Routes ---

@router.get("/prompts")
async def get_prompts(level: Optional[str] = None, category: Optional[str] = None):
    """Retrieve writing prompts directly from Firestore with level and category filters, with auto-seeding."""
    prompts = []
    if db:
        try:
            query = db.collection("writing_prompts")
            if level and level.upper() != "ALL":
                query = query.where("level", "==", level.upper())
            if category and category.lower() != "all":
                query = query.where("category", "==", category)

            docs = query.stream()
            for doc in docs:
                item = doc.to_dict()
                if "id" not in item:
                    item["id"] = doc.id
                prompts.append(item)

            # If the database is completely empty on initial setup, auto-seed it
            if not prompts and (not level or level.upper() == "ALL") and (not category or category.lower() == "all"):
                print("DEBUG: writing_prompts collection empty in Firestore. Auto-seeding...")
                for p in DEFAULT_WRITING_PROMPTS:
                    db.collection("writing_prompts").document(p["id"]).set(p, merge=True)
                prompts = DEFAULT_WRITING_PROMPTS.copy()
        except Exception as e:
            print(f"DEBUG: Firestore error retrieving writing prompts: {e}")
            prompts = []

    # Safe fallback to default seed list if DB is offline or empty for filter
    if not prompts:
        prompts = DEFAULT_WRITING_PROMPTS.copy()
        if level and level.upper() != "ALL":
            prompts = [p for p in prompts if p.get("level", "").upper() == level.upper()]
        if category and category.lower() != "all":
            prompts = [p for p in prompts if p.get("category", "").lower() == category.lower()]

    prompts.sort(key=lambda p: (p.get("order", 99), p.get("title", "")))
    return {"prompts": prompts}

@router.post("/prompts")
async def create_prompt(prompt: WritingPromptCreateRequest, current_student: str = Depends(verify_student_token)):
    """Add or update a writing prompt in the Firestore database."""
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")

    doc_id = prompt.id or f"{prompt.level.lower()}-{re.sub(r'[^a-z0-9]+', '-', prompt.title.lower()).strip('-')}"
    data = prompt.dict()
    data["id"] = doc_id

    try:
        db.collection("writing_prompts").document(doc_id).set(data, merge=True)
        return {"status": "success", "prompt": data}
    except Exception as e:
        print(f"Error saving writing prompt: {e}")
        raise HTTPException(status_code=500, detail="Failed to save prompt to database")

@router.post("/assess")
async def assess_writing(req: WritingAssessRequest, current_student: str = Depends(verify_student_token)):
    """Assess a student's writing using Groq AI with automatic fallback to Gemini and local heuristics."""
    text = (req.text or "").strip()
    if len(text) < 15:
        raise HTTPException(status_code=400, detail="Writing submission is too short to evaluate. Please write at least one complete sentence.")

    words = re.findall(r"\b\w+\b", text)
    word_count = len(words)
    reading_time = round(word_count / 180, 1)

    user_prompt_content = f"""Student Target Level: {req.cefrLevel}
Writing Prompt Title: {req.promptTitle or 'Free Writing Exercise'}
Writing Prompt Category: {req.promptCategory or 'General'}

Student's Written Submission:
---
{text}
---
Perform a full assessment according to the specified JSON schema."""

    # 1. Primary Attempt: Groq AI
    if GROQ_API_KEY:
        for model_name in ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"]:
            try:
                import groq
                client = groq.Groq(api_key=GROQ_API_KEY)
                res = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": ASSESSMENT_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt_content}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.3,
                    max_tokens=2000
                )
                raw_json = res.choices[0].message.content
                assessment = _clean_json_response(raw_json)
                assessment["wordCount"] = word_count
                assessment["readingTime"] = reading_time
                assessment["evaluatorModel"] = f"Groq ({model_name})"
                return {"assessment": assessment}
            except Exception as e:
                print(f"DEBUG: Groq evaluation with {model_name} failed: {e}")

    # 2. Secondary Attempt: Google Gemini Flash
    if GEMINI_API_KEY:
        for gemini_model_name in ["gemini-2.5-flash", "gemini-flash-latest"]:
            try:
                import google.generativeai as genai
                genai.configure(api_key=GEMINI_API_KEY)
                model = genai.GenerativeModel(gemini_model_name)
                res = model.generate_content(
                    f"{ASSESSMENT_SYSTEM_PROMPT}\n\n{user_prompt_content}",
                    generation_config={"response_mime_type": "application/json", "temperature": 0.3}
                )
                assessment = _clean_json_response(res.text)
                assessment["wordCount"] = word_count
                assessment["readingTime"] = reading_time
                assessment["evaluatorModel"] = f"Gemini ({gemini_model_name})"
                return {"assessment": assessment}
            except Exception as ge:
                print(f"DEBUG: Gemini evaluation with {gemini_model_name} failed: {ge}")

    # 3. Final Fallback: Heuristic Evaluator
    print("DEBUG: Using heuristic fallback assessment.")
    assessment = _heuristic_fallback_assessment(text, req.cefrLevel)
    assessment["wordCount"] = word_count
    assessment["readingTime"] = reading_time
    assessment["evaluatorModel"] = "Local Heuristic Engine"
    return {"assessment": assessment}

@router.post("/save")
async def save_writing(req: WritingSaveRequest, current_student: str = Depends(verify_student_token)):
    """Save an assessed writing submission to the student's portfolio in Firestore."""
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")

    timestamp = req.timestamp or datetime.now(timezone.utc).isoformat()
    submission_data = {
        "studentId": req.studentId,
        "promptId": req.promptId,
        "promptTitle": req.promptTitle or "Free Writing",
        "promptCategory": req.promptCategory or "General",
        "text": req.text,
        "wordCount": req.wordCount,
        "overallScore": req.overallScore,
        "cefrLevel": req.cefrLevel,
        "assessment": req.assessment,
        "timestamp": timestamp
    }

    try:
        doc_ref = db.collection("writing_submissions").add(submission_data)
        doc_id = doc_ref[1].id if isinstance(doc_ref, tuple) else doc_ref.id

        # Update student aggregate writing metrics
        try:
            student_ref = db.collection("students").document(req.studentId)
            student_doc = student_ref.get()
            if student_doc.exists:
                data = student_doc.to_dict()
                total_writing = data.get("totalWritingSubmissions", 0) + 1
                prev_avg = data.get("avgWritingScore", req.overallScore)
                new_avg = round(((prev_avg * (total_writing - 1)) + req.overallScore) / total_writing)
                student_ref.update({
                    "totalWritingSubmissions": total_writing,
                    "avgWritingScore": new_avg,
                    "lastWritingDate": timestamp
                })
        except Exception as se:
            print(f"DEBUG: Note updating student stats: {se}")

        return {"status": "success", "submissionId": doc_id, "timestamp": timestamp}
    except Exception as e:
        print(f"Error saving writing submission: {e}")
        raise HTTPException(status_code=500, detail="Failed to save writing submission")

@router.get("/history")
async def get_writing_history(
    studentId: str = Query(...),
    limit: int = Query(20, le=100),
    current_student: str = Depends(verify_student_token)
):
    """Retrieve all past writing submissions and assessments for a student."""
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        docs = db.collection("writing_submissions").where("studentId", "==", studentId).stream()
        submissions = []
        for doc in docs:
            item = doc.to_dict()
            item["id"] = doc.id
            submissions.append(item)

        # Sort descending by timestamp
        submissions.sort(key=lambda s: s.get("timestamp", ""), reverse=True)
        return {"submissions": submissions[:limit]}
    except Exception as e:
        print(f"Error fetching writing history: {e}")
        raise HTTPException(status_code=500, detail="Failed to load writing history")
