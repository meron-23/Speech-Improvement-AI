import os
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, auth, firestore
import requests
import json
import base64
from dotenv import load_dotenv
import tempfile
import io
import csv
from fastapi.responses import PlainTextResponse

load_dotenv()

# Setup Firebase
try:
    firebase_service_account = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if firebase_service_account:
        # Load from environment variable (JSON string)
        import json
        service_account_info = json.loads(firebase_service_account)
        cred = credentials.Certificate(service_account_info)
    else:
        # Fallback to local file for development
        cred = credentials.Certificate("speech-improvement-ai-916685eed011.json")
    
    firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    print(f"Error initializing Firebase: {e}")
    db = None

# Setup NVIDIA Riva
NVIDIA_API_KEY = os.environ.get('NVIDIA_API_KEY')
NVIDIA_FUNCTION_ID = "d3fe9151-442b-4204-a70d-5fcc597fd610"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    studentId: str

@app.post("/auth/login")
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
    
    # Generate custom token for Firebase Authentication
    try:
        custom_token = auth.create_custom_token(req.studentId)
        token_str = custom_token.decode("utf-8") if isinstance(custom_token, bytes) else custom_token
    except Exception as e:
        print(f"Error creating custom token: {e}")
        token_str = "mock_token"

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

@app.post("/stt")
async def stt(audio: UploadFile = File(...)):
    # Read audio bytes
    audio_bytes = await audio.read()
    if len(audio_bytes) < 1500:
        print(f"DEBUG: Audio file too small for transcription: {len(audio_bytes)} bytes")
        return {"text": ""}
    
    try:
        print(f"DEBUG: Received audio file. Size: {len(audio_bytes)} bytes")
        
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if not gemini_key:
            print("DEBUG: No GEMINI_API_KEY set in environment")
            return {"text": ""}

        print(f"DEBUG: Transcribing with Gemini REST API...")
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        mime_type = audio.content_type or "audio/webm"
        
        # Using gemini-2.5-flash as it is supported and configured for this project
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "inlineData": {
                                "mimeType": mime_type,
                                "data": audio_b64
                            }
                        },
                        {
                            "text": "Transcribe only clear human speech in this audio. The speech may be in English, Amharic, or other languages. Return ONLY the exact words spoken in the language they were spoken. If there is no clear speech, background noise only, silence, music, or you are unsure, return an empty string."
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0
            }
        }
        
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
        if response.status_code != 200:
            print(f"DEBUG: Gemini API returned status {response.status_code}: {response.text}")
            return {"text": ""}
            
        res_json = response.json()
        transcript = ""
        try:
            transcript = res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as extract_err:
            print(f"DEBUG: Failed to parse Gemini response: {extract_err}. Response: {res_json}")
            
        if transcript:
            no_speech_markers = [
                "no clear speech",
                "no speech",
                "silence",
                "background noise",
                "empty string",
                "inaudible",
                "unclear",
                "i'm sorry",
                "i cannot",
                "i can't",
                "there is no",
                "nothing to transcribe",
            ]
            normalized_transcript = transcript.lower().strip(" .!\"'`")
            if (
                not normalized_transcript
                or normalized_transcript in {"", "''", '""', "n/a", "none"}
                or any(marker in normalized_transcript for marker in no_speech_markers)
            ):
                print(f"DEBUG: STT returned no-speech marker: {transcript}")
                return {"text": ""}
            print(f"DEBUG: STT Success: {transcript}")
            return {"text": transcript}
    except Exception as e:
        print(f"DEBUG: STT Error: {e}")
    return {"text": ""}

class ConversationRequest(BaseModel):
    transcript: str
    history: list
    cefrLevel: str
    lesson: dict = None

@app.post("/conversation")
async def conversation(req: ConversationRequest):
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        return {"text": "That is wonderful to hear! Consistent practice is the key to improvement."}

    try:
        from groq import Groq
        groq_client = Groq(api_key=groq_key)
        
        system_prompt = f"You are a friendly English conversation partner for a {req.cefrLevel} student."
        if req.lesson:
            system_prompt = f"""You are playing a role for a lesson: '{req.lesson.get('title')}'.
Your Role: {req.lesson.get('aiRole')}
The Context: {req.lesson.get('context')}
The Student's Objective: {req.lesson.get('objective')}
Stay in character and help the student achieve their objective through conversation."""

        system_prompt += f"""
ADAPTIVE STYLE:
- If Student is A1/A2: Use very simple grammar, high-frequency vocabulary, and short sentences. Avoid idioms or complex metaphors.
- If Student is B1/B2: Use natural conversational English, including common idioms and slightly more complex sentence structures. Challenge the student to express more detailed ideas.

Keep your responses natural and appropriate for a {req.cefrLevel} level student.
Ask follow-up questions to keep the conversation moving.
Do NOT correct the student's grammar during the conversation; keep the flow going.

STRICT RULE: If the user's input is NOT in English (e.g., they speak in another language), do not answer their question or continue the topic. Instead, politely nudge them to try speaking in English. For example: "I'm sorry, I didn't quite understand. Could you try saying that in English?"
"""
        messages = [{"role": "system", "content": system_prompt}]
        for msg in req.history:
            role = "assistant" if msg["role"] == "ai" else "user"
            messages.append({"role": role, "content": msg["text"]})
        messages.append({"role": "user", "content": req.transcript})
        
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=messages,
            temperature=0.7,
            max_tokens=150,
        )
        return {"text": response.choices[0].message.content}
    except Exception as e:
        print("Groq Exception:", str(e))
        return {"text": "That is wonderful to hear! Consistent practice is the key to improvement."}

class TTSRequest(BaseModel):
    text: str

@app.post("/tts")
async def tts(req: TTSRequest):
    # Google Translate TTS has a ~200 character limit per request.
    # We split the text into chunks to avoid 400 Bad Request.
    text = req.text
    max_chunk_size = 200
    chunks = [text[i:i + max_chunk_size] for i in range(0, len(text), max_chunk_size)]
    
    combined_audio = b""
    
    try:
        from urllib.parse import quote
        for chunk in chunks:
            encoded_chunk = quote(chunk)
            url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={encoded_chunk}&tl=en&client=tw-ob"
            response = requests.get(url)
            if response.status_code == 200:
                combined_audio += response.content
            else:
                print(f"Google TTS Error for chunk: {response.text}")
        
        if combined_audio:
            audio_base64 = base64.b64encode(combined_audio).decode("utf-8")
            return {"audio": audio_base64, "format": "mp3"}
        else:
            return {"audio": ""}
    except Exception as e:
        print("TTS Exception:", str(e))
        return {"audio": ""}

@app.websocket("/chat_stream")
async def chat_stream(websocket: WebSocket):
    await websocket.accept()
    
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        await websocket.close(code=1008)
        return
        
    from groq import Groq
    groq_client = Groq(api_key=groq_key)
    
    try:
        while True:
            # 1. Receive JSON payload (history, cefrLevel, lesson, transcript)
            payload = await websocket.receive_json()
            msg_type = payload.get("type")
            print(f"[CHAT_STREAM] Received message type: {msg_type}")
            
            if msg_type == "ping":
                print("[CHAT_STREAM] Ping received, continuing...")
                continue
                
            is_start = (msg_type == "start")
            transcript = payload.get("transcript")
            
            if not transcript and not is_start:
                print("[CHAT_STREAM] No transcript and not start, continuing...")
                continue
                
            if transcript:
                print(f"[CHAT_STREAM] User transcript: {transcript}")
                # Send transcript back so UI can display what user said
                await websocket.send_json({"type": "transcript", "text": transcript})
            
            # 2. LLM Generation
            history = payload.get("history", [])
            cefrLevel = payload.get("cefrLevel", "B1")
            lesson = payload.get("lesson")
            
            system_prompt = f"You are a friendly English conversation partner for a {cefrLevel} student."
            if lesson:
                system_prompt = f"""You are playing a role for a lesson: '{lesson.get('title')}'.
Your Role: {lesson.get('aiRole')}
The Context: {lesson.get('context')}
The Student's Objective: {lesson.get('objective')}
Stay in character and help the student achieve their objective through conversation."""

            if is_start:
                system_prompt += "\n\nThis is the very beginning of the conversation. Start the roleplay by greeting the student naturally according to the context and your role. Keep it short and engaging!"

            system_prompt += f"""
ADAPTIVE STYLE:
- If Student is A1/A2: Use very simple grammar, high-frequency vocabulary, and short sentences. Avoid idioms or complex metaphors.
- If Student is B1/B2: Use natural conversational English, including common idioms and slightly more complex sentence structures. Challenge the student to express more detailed ideas.

Keep your responses natural and appropriate for a {cefrLevel} level student.
Ask follow-up questions to keep the conversation moving.
Do NOT correct the student's grammar during the conversation; keep the flow going.

STRICT RULE: If the user's input is NOT in English (e.g., they speak in another language), do not answer their question or continue the topic. Instead, politely nudge them to try speaking in English. For example: "I'm sorry, I didn't quite understand. Could you try saying that in English?"
"""
            messages = [{"role": "system", "content": system_prompt}]
            for msg in history:
                role = "assistant" if msg["role"] == "ai" else "user"
                messages.append({"role": role, "content": msg["text"]})
            if transcript:
                messages.append({"role": "user", "content": transcript})
            
            try:
                # Use Groq for ultra-fast generation
                print(f"[CHAT_STREAM] Calling Groq with {len(messages)} messages...")
                response = groq_client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=messages,
                    temperature=0.7,
                    max_tokens=150,
                )
                full_ai_text = response.choices[0].message.content
                print(f"[CHAT_STREAM] Groq response: {full_ai_text}")

                # Send text immediately
                print("[CHAT_STREAM] Sending text to client...")
                await websocket.send_json({
                    "type": "text",
                    "text": full_ai_text
                })
                
                # Use Google Translate TTS (free) instead of Cartesia
                try:
                    print("[CHAT_STREAM] Starting TTS generation...")
                    from urllib.parse import quote
                    max_chunk_size = 200
                    text_to_speak = full_ai_text
                    chunks = [text_to_speak[i:i + max_chunk_size] for i in range(0, len(text_to_speak), max_chunk_size)]
                    print(f"[CHAT_STREAM] TTS text split into {len(chunks)} chunks")
                    combined_audio = b""
                    for idx, chunk in enumerate(chunks):
                        encoded_chunk = quote(chunk)
                        tts_url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={encoded_chunk}&tl=en&client=tw-ob"
                        tts_resp = requests.get(tts_url, headers={"User-Agent": "Mozilla/5.0"})
                        if tts_resp.status_code == 200:
                            combined_audio += tts_resp.content
                            print(f"[CHAT_STREAM] TTS chunk {idx + 1} received. Size: {len(tts_resp.content)} bytes")
                        else:
                            print(f"[CHAT_STREAM] TTS chunk {idx + 1} failed. Status: {tts_resp.status_code}")
                    if combined_audio:
                        audio_base64 = base64.b64encode(combined_audio).decode("utf-8")
                        print(f"[CHAT_STREAM] Sending audio to client. Base64 size: {len(audio_base64)} bytes")
                        await websocket.send_json({"type": "audio", "audio": audio_base64})
                    else:
                        print("[CHAT_STREAM] No audio generated from TTS")
                except Exception as tts_err:
                    print("[CHAT_STREAM] Google TTS exception:", tts_err)


                # Signal end of turn
                print("[CHAT_STREAM] Sending DONE signal")
                await websocket.send_json({"type": "done", "full_text": full_ai_text.strip()})
            except Exception as generation_err:
                print(f"[CHAT_STREAM] Error during Groq generation: {generation_err}")
                await websocket.send_json({"type": "done", "full_text": "I'm having a bit of trouble connecting right now."})
                
    except WebSocketDisconnect:
        print("[CHAT_STREAM] WebSocket Client disconnected")
    except Exception as e:
        print(f"[CHAT_STREAM] WebSocket Exception: {e}")

class SessionSaveRequest(BaseModel):
    studentId: str
    cefrLevel: str
    timestamp: str
    conversation: list
    feedback: object
    lessonId: str = None

def _matches_objective(conversation: list, objective: str) -> bool:
    if not objective:
        return False
    user_text = " ".join([msg.get("text", "") for msg in conversation if msg.get("role") == "user"]).lower()
    if len(user_text) < 20:
        return False
    import re
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

@app.post("/session/save")
async def save_session(req: SessionSaveRequest):
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # 1. AI Evaluation: Did the student pass?
    passed = False
    next_lesson = None
    level_complete = False
    
    if req.lessonId:
        lesson_doc = db.collection("curriculum").document(req.lessonId).get()
        if lesson_doc.exists:
            lesson_data = lesson_doc.to_dict()
            objective = lesson_data.get("objective")
            
            # Use Groq to judge the conversation
            groq_key = os.environ.get("GROQ_API_KEY")
            
            # Check if conversation is too short to pass
            user_turns = len([msg for msg in req.conversation if msg['role'] == 'user'])
            if user_turns < 3:
                passed = False
            elif groq_key:
                try:
                    from groq import Groq
                    groq_client = Groq(api_key=groq_key)
                    
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
                        model="llama-3.1-8b-instant",
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
                # When no Groq evaluator is configured, only pass if the conversation clearly meets the lesson objective.
                if user_turns >= 4 and _matches_objective(req.conversation, objective):
                    passed = True

    # 2. Update Student Progress if passed
    if passed:
        # Find next lesson in order
        current_lesson_doc = db.collection("curriculum").document(req.lessonId).get()
        if current_lesson_doc.exists:
            current_order = current_lesson_doc.to_dict().get("order", 1)
            
            next_lessons = db.collection("curriculum").where("order", "==", current_order + 1).limit(1).stream()
            
            for doc in next_lessons:
                next_lesson = doc.to_dict()
                db.collection("students").document(req.studentId).update({
                    "currentLessonId": next_lesson["lessonId"]
                })
            
            if not next_lesson:
                level_complete = True

        # Determine if the level is complete
        if not next_lesson:
            level_complete = True
        else:
            next_level = next_lesson.get("cefrLevel")
            if next_level and next_level != req.cefrLevel:
                level_complete = True
                next_lesson = None

    # 3. Save the session
    session_data = req.model_dump()
    session_data["passed"] = passed
    doc_ref = db.collection("sessions").document()
    doc_ref.set(session_data)
    
    # 4. Update Practice Streak and level completion flag
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

class FeedbackRequest(BaseModel):
    conversation: list
    cefrLevel: str = "B1"
    lesson: dict = None

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
    return {
        "summary": "Here is your speaking profile from the 4-minute assessment.",
        "metrics": metrics
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

    return {
        "summary": raw_report.get("summary", "Here is your speaking profile from the 4-minute assessment.") if isinstance(raw_report, dict) else "Here is your speaking profile from the 4-minute assessment.",
        "metrics": normalized_metrics
    }

@app.post("/feedback")
async def generate_feedback(req: FeedbackRequest):
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        report = _build_fallback_feedback(req.conversation)
        return {"feedback": json.dumps(report), "report": report}

    try:
        from groq import Groq
        groq_client = Groq(api_key=groq_key)
        
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

JSON shape:
{{
  "summary": "short friendly summary",
  "metrics": {{
    "Grammar": [{{"answer": "student answer", "score": 1, "issue": "", "suggestion": ""}}],
    "Accuracy": [{{"answer": "student answer", "score": 0.5, "issue": "", "suggestion": ""}}]
  }},
  "quickTips": {{
    "Grammar": "one short tip",
    "Accuracy": "one short tip"
  }}
}}

Conversation:
{full_conversation}"""
        
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )

        content = response.choices[0].message.content.strip()
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

@app.get("/auth/deepgram")
async def get_deepgram_token():
    deepgram_key = os.environ.get("DEEPGRAM_API_KEY")
    if not deepgram_key:
        raise HTTPException(status_code=500, detail="Deepgram API key not configured")
    
    # Return the key directly for MVP. In production, use Deepgram API to generate a temporary token.
    return {"key": deepgram_key}

class UpdateStudentRequest(BaseModel):
    studentId: str
    name: str = None
    cefrLevel: str = None

@app.post("/student/update")
async def update_student(req: UpdateStudentRequest):
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
        
    # If CEFR level was updated, reset their currentLessonId to the first lesson of that level!
    if req.cefrLevel is not None:
        lessons_query = db.collection("curriculum").where("cefrLevel", "==", req.cefrLevel).stream()
        lessons_list = []
        for l_doc in lessons_query:
            lessons_list.append(l_doc.to_dict())
        lessons_list.sort(key=lambda x: x.get("order", 0))
        if lessons_list:
            new_lesson_id = lessons_list[0]["lessonId"]
            doc_ref.update({"currentLessonId": new_lesson_id})
            
    # Fetch updated details
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

@app.get("/student/{student_id}")
async def get_student(student_id: str):
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    doc_ref = db.collection("students").document(student_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Student not found")
        
    student_data = doc.to_dict()
    
    # Fetch current lesson details
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

@app.get("/lessons")
async def get_lessons(level: str = None):
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

@app.get("/sessions")
async def get_sessions(studentId: str):
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    docs = db.collection("sessions").where("studentId", "==", studentId).stream()
    sessions = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        sessions.append(d)
    return {"sessions": sessions}

@app.get("/export")
async def export_sessions():
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
