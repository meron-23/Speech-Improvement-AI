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
    
    try:
        print(f"DEBUG: Received audio file. Size: {len(audio_bytes)} bytes")
        
        import google.generativeai as genai
        gemini_key = os.environ.get("GEMINI_API_KEY")
        genai.configure(api_key=gemini_key)
        
        # Save bytes to a temp file because genai.upload_file needs a path
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        
        try:
            print(f"DEBUG: Transcribing with Gemini 3.1 Flash...")
            audio_file = genai.upload_file(path=tmp_path, display_name="User Speech")
            
            # Using the model we confirmed is available on your account
            model = genai.GenerativeModel('models/gemini-3.1-flash-lite')
            response = model.generate_content([
                audio_file, 
                "Transcribe this audio exactly. Return ONLY the transcript text, nothing else."
            ])
            
            if response.text:
                transcript = response.text.strip()
                print(f"DEBUG: STT Success: {transcript}")
                return {"text": transcript}
        finally:
            # Always cleanup temp file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            
    except Exception as e:
        print(f"DEBUG: STT Error: {e}")
        
    return {"text": "I think my English is getting better every day."}

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
    cartesia_key = os.environ.get("CARTESIA_API_KEY")
    if not groq_key or not cartesia_key:
        await websocket.close(code=1008)
        return
        
    from groq import Groq
    groq_client = Groq(api_key=groq_key)
    
    try:
        while True:
            # 1. Receive JSON payload (history, cefrLevel, lesson, transcript)
            payload = await websocket.receive_json()
            msg_type = payload.get("type")
            
            if msg_type == "ping":
                continue
                
            is_start = (msg_type == "start")
            transcript = payload.get("transcript")
            
            if not transcript and not is_start:
                continue
                
            if transcript:
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
                response = groq_client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=messages,
                    temperature=0.7,
                    max_tokens=150,
                )
                full_ai_text = response.choices[0].message.content

                # Send text immediately
                await websocket.send_json({
                    "type": "text",
                    "text": full_ai_text
                })
                
                # Use Cartesia to generate audio instantly
                try:
                    tts_resp = requests.post(
                        "https://api.cartesia.ai/tts/bytes",
                        headers={
                            "X-API-Key": cartesia_key,
                            "Cartesia-Version": "2024-06-10",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model_id": "sonic-3.5",
                            "transcript": full_ai_text,
                            "voice": {
                                "mode": "id",
                                "id": "a0e99841-438c-4a64-b679-ae501e7d6091" # English Woman
                            },
                            "output_format": {
                                "container": "mp3",
                                "encoding": "mp3",
                                "sample_rate": 44100
                            }
                        }
                    )
                    if tts_resp.status_code == 200:
                        audio_base64 = base64.b64encode(tts_resp.content).decode("utf-8")
                        await websocket.send_json({"type": "audio", "audio": audio_base64})
                    else:
                        print("Cartesia TTS Error:", tts_resp.text)
                except Exception as tts_err:
                    print("Cartesia exception:", tts_err)

                # Signal end of turn
                await websocket.send_json({"type": "done", "full_text": full_ai_text.strip()})
            except Exception as generation_err:
                print(f"Error during Groq generation: {generation_err}")
                await websocket.send_json({"type": "done", "full_text": "I'm having a bit of trouble connecting right now."})
                
    except WebSocketDisconnect:
        print("WebSocket Client disconnected")
    except Exception as e:
        print(f"WebSocket Exception: {e}")

class SessionSaveRequest(BaseModel):
    studentId: str
    cefrLevel: str
    timestamp: str
    conversation: list
    feedback: str
    lessonId: str = None

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
            if user_turns < 2:
                passed = False
            elif groq_key:
                try:
                    from groq import Groq
                    groq_client = Groq(api_key=groq_key)
                    
                    transcript = "\n".join([f"{msg['role']}: {msg['text']}" for msg in req.conversation])
                    eval_prompt = f"""You are a STRICT language instructor. Review this English learning conversation.
Student Level: {req.cefrLevel}
Objective: {objective}

Conversation:
{transcript}

Did the student clearly and explicitly achieve the objective? 

STRICT Grading Standards:
1. The student MUST have fulfilled the specific objective mentioned above. If they just said "hello" or gave generic/unrelated answers, they FAIL.
2. If the student spoke in a language other than English, they FAIL.
3. If the student gave extremely short, unengaged answers without demonstrating the required language skills, they FAIL.
4. For A1/A2: They must attempt basic communication directly related to the goal.
5. For B1/B2: They must use proper sentence structure and actively drive the conversation toward the goal.

Answer ONLY with 'YES' or 'NO'. Do not provide any other text. If in doubt, answer 'NO'."""
                    
                    response = groq_client.chat.completions.create(
                        model="llama-3.1-8b-instant",
                        messages=[{"role": "user", "content": eval_prompt}],
                        temperature=0.1,
                    )
                    
                    if "YES" in response.choices[0].message.content.upper():
                        passed = True
                except Exception as e:
                    print(f"Evaluation error: {e}")

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

@app.post("/feedback")
async def generate_feedback(req: FeedbackRequest):
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        return {"feedback": "Your pronunciation is very clear! One tip: make sure to use the present continuous tense correctly when talking about ongoing actions (e.g., 'I am practicing' instead of 'I practice')."}

    try:
        from groq import Groq
        groq_client = Groq(api_key=groq_key)
        
        formatted_convo = []
        for msg in req.conversation:
            if msg['role'] == 'user':
                formatted_convo.append(f"STUDENT SAID: {msg['text']}")
            else:
                formatted_convo.append(f"COACH SAID: {msg['text']}")
        full_conversation = "\n".join(formatted_convo)
        
        prompt = f"""Analyze this English practice session.
You are a direct, helpful coach focusing on grammar and accuracy!
You MUST ONLY analyze the sentences labeled "STUDENT SAID". DO NOT analyze "COACH SAID".

CRITICAL RULE: 
- DO NOT use any Markdown formatting. 
- DO NOT use hash symbols (#), stars (** or *), or greater-than symbols (>).
- Use ONLY plain text with double line breaks for spacing.

Format your response exactly like this:
💬 YOU SAID:
[Quote a specific sentence from "STUDENT SAID" that had a grammar mistake, or their best sentence if no mistakes]

🎯 ACCURACY:
[Give a % score for the student's grammar accuracy overall]

💡 REASON & FIX:
[Explain why the student's quote was incorrect (or correct) and provide the improved version]

Conversation:
{full_conversation}"""
        
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )

        return {"feedback": response.choices[0].message.content}
    except Exception as e:
        print("Groq Feedback Exception:", str(e))
        return {"feedback": "Your pronunciation is very clear! One tip: make sure to use the present continuous tense correctly when talking about ongoing actions (e.g., 'I am practicing' instead of 'I practice')."}

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
