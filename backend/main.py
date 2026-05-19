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
import riva.client

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
        lessons_query = db.collection("curriculum").where("cefrLevel", "==", level).order_by("order").limit(1).stream()
        for l_doc in lessons_query:
            lesson_id = l_doc.id
        
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
            "currentLesson": current_lesson
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
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        return {"text": "That is wonderful to hear! Consistent practice is the key to improvement. What topics do you find most difficult to talk about?"}

    try:
        import google.generativeai as genai
        genai.configure(api_key=gemini_key)
        # Using a model name that exists in this environment
        try:
            model = genai.GenerativeModel('models/gemini-3.1-flash-lite')
        except:
            model = genai.GenerativeModel('gemini-pro')
        
        history_text = "\n".join([f"{msg['role']}: {msg['text']}" for msg in req.history])
        # Default prompt if no lesson is provided
        role_instruction = f"You are a friendly English conversation partner for a {req.cefrLevel} student."
        if req.lesson:
            role_instruction = f"""You are playing a role for a lesson: '{req.lesson.get('title')}'.
Your Role: {req.lesson.get('aiRole')}
The Context: {req.lesson.get('context')}
The Student's Objective: {req.lesson.get('objective')}
Stay in character and help the student achieve their objective through conversation."""

        prompt = f"""{role_instruction}
ADAPTIVE STYLE:
- If Student is A1/A2: Use very simple grammar, high-frequency vocabulary, and short sentences. Avoid idioms or complex metaphors.
- If Student is B1/B2: Use natural conversational English, including common idioms and slightly more complex sentence structures. Challenge the student to express more detailed ideas.

Keep your responses natural and appropriate for a {req.cefrLevel} level student.
Ask follow-up questions to keep the conversation moving.
Do NOT correct the student's grammar during the conversation; keep the flow going.

STRICT RULE: If the user's input is NOT in English (e.g., they speak in another language), do not answer their question or continue the topic. Instead, politely nudge them to try speaking in English. For example: "I'm sorry, I didn't quite understand. Could you try saying that in English?"

Conversation:
{history_text}

User: {req.transcript}
AI:"""
        
        try:
            response = model.generate_content(prompt)
        except Exception as e:
            print(f"Gemini error: {e}, trying fallback")
            model = genai.GenerativeModel('models/gemini-3.1-flash-lite')
            response = model.generate_content(prompt)

        return {"text": response.text}
    except Exception as e:
        print("Gemini Exception:", str(e))
        return {"text": "That is wonderful to hear! Consistent practice is the key to improvement. What topics do you find most difficult to talk about?"}

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
    
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        await websocket.close(code=1008)
        return
        
    import google.generativeai as genai
    genai.configure(api_key=gemini_key)
    
    try:
        model = genai.GenerativeModel('models/gemini-3.1-flash-lite')
    except:
        model = genai.GenerativeModel('gemini-pro')
        
    try:
        while True:
            # 1. Receive JSON payload (history, cefrLevel, lesson, transcript)
            payload = await websocket.receive_json()
            transcript = payload.get("transcript")
            
            if not transcript:
                continue
                
            # Send transcript back so UI can display what user said
            await websocket.send_json({"type": "transcript", "text": transcript})
            
            # 4. LLM Generation (Streaming)
            history = payload.get("history", [])
            cefrLevel = payload.get("cefrLevel", "B1")
            lesson = payload.get("lesson")
            
            history_text = "\n".join([f"{msg['role']}: {msg['text']}" for msg in history])
            role_instruction = f"You are a friendly English conversation partner for a {cefrLevel} student."
            if lesson:
                role_instruction = f"""You are playing a role for a lesson: '{lesson.get('title')}'.
Your Role: {lesson.get('aiRole')}
The Context: {lesson.get('context')}
The Student's Objective: {lesson.get('objective')}
Stay in character and help the student achieve their objective through conversation."""

            prompt = f"""{role_instruction}
ADAPTIVE STYLE:
- If Student is A1/A2: Use very simple grammar, high-frequency vocabulary, and short sentences. Avoid idioms or complex metaphors.
- If Student is B1/B2: Use natural conversational English, including common idioms and slightly more complex sentence structures. Challenge the student to express more detailed ideas.

Keep your responses natural and appropriate for a {cefrLevel} level student.
Ask follow-up questions to keep the conversation moving.
Do NOT correct the student's grammar during the conversation; keep the flow going.

STRICT RULE: If the user's input is NOT in English (e.g., they speak in another language), do not answer their question or continue the topic. Instead, politely nudge them to try speaking in English. For example: "I'm sorry, I didn't quite understand. Could you try saying that in English?"

Conversation:
{history_text}

User: {transcript}
AI:"""
            
            try:
                response_stream = model.generate_content(prompt, stream=True)
                
                sentence_buffer = ""
                full_ai_text = ""
                import re
                from urllib.parse import quote
                
                for chunk in response_stream:
                    text_chunk = chunk.text
                    if not text_chunk:
                        continue
                    sentence_buffer += text_chunk
                    full_ai_text += text_chunk
                    
                    # Split by sentence boundaries (. ? !)
                    parts = re.split(r'(?<=[.?!])\s+', sentence_buffer)
                    
                    if len(parts) > 1:
                        for i in range(len(parts) - 1):
                            sentence = parts[i].strip()
                            if not sentence: continue
                            
                            # 5. TTS for this sentence
                            encoded_sentence = quote(sentence)
                            url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={encoded_sentence}&tl=en&client=tw-ob"
                            tts_res = requests.get(url)
                            
                            if tts_res.status_code == 200:
                                audio_b64 = base64.b64encode(tts_res.content).decode("utf-8")
                                await websocket.send_json({
                                    "type": "audio", 
                                    "text": sentence, 
                                    "audio": audio_b64
                                })
                        
                        sentence_buffer = parts[-1] 
                
                # Process any remaining text in buffer
                sentence_buffer = sentence_buffer.strip()
                if sentence_buffer:
                    encoded_sentence = quote(sentence_buffer)
                    url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={encoded_sentence}&tl=en&client=tw-ob"
                    tts_res = requests.get(url)
                    if tts_res.status_code == 200:
                        audio_b64 = base64.b64encode(tts_res.content).decode("utf-8")
                        await websocket.send_json({
                            "type": "audio", 
                            "text": sentence_buffer, 
                            "audio": audio_b64
                        })
                
                # 6. Signal end of turn
                await websocket.send_json({"type": "done", "full_text": full_ai_text.strip()})
            except Exception as generation_err:
                print(f"Error during streaming generation: {generation_err}")
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
    
    if req.lessonId:
        lesson_doc = db.collection("curriculum").document(req.lessonId).get()
        if lesson_doc.exists:
            lesson_data = lesson_doc.to_dict()
            objective = lesson_data.get("objective")
            
            # Use Gemini to judge the conversation
            gemini_key = os.environ.get("GEMINI_API_KEY")
            
            # Check if conversation is too short to pass
            user_turns = len([msg for msg in req.conversation if msg['role'] == 'user'])
            if user_turns < 2:
                passed = False
            elif gemini_key:
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=gemini_key)
                    try:
                        model = genai.GenerativeModel('models/gemini-3.1-flash-lite')
                    except:
                        model = genai.GenerativeModel('gemini-pro')
                    
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
                    
                    response = model.generate_content(eval_prompt)
                    if "YES" in response.text.upper():
                        passed = True
                except Exception as e:
                    print(f"Evaluation error: {e}")

    # 2. Update Student Progress if passed
    if passed:
        # Find next lesson in order
        current_lesson_doc = db.collection("curriculum").document(req.lessonId).get()
        if current_lesson_doc.exists:
            current_order = current_lesson_doc.to_dict().get("order", 1)
            print(f"DEBUG: Student passed. Current Order: {current_order}. Looking for Order: {current_order + 1}")
            
            next_lessons = db.collection("curriculum").where("order", "==", current_order + 1).limit(1).stream()
            
            for doc in next_lessons:
                next_lesson = doc.to_dict()
                print(f"DEBUG: Found Next Lesson: {next_lesson['title']} ({next_lesson['lessonId']})")
                # Update student record
                db.collection("students").document(req.studentId).update({
                    "currentLessonId": next_lesson["lessonId"]
                })
            
            if not next_lesson:
                print("DEBUG: No next lesson found in order.")

    # 3. Save the session
    session_data = req.model_dump()
    session_data["passed"] = passed
    doc_ref = db.collection("sessions").document()
    doc_ref.set(session_data)
    
    # 4. Update Practice Streak
    db.collection("students").document(req.studentId).update({
        "practiceStreak": firestore.Increment(1)
    })
    
    return {
        "id": doc_ref.id, 
        "passed": passed, 
        "nextLesson": next_lesson
    }

class FeedbackRequest(BaseModel):
    conversation: list

@app.post("/feedback")
async def generate_feedback(req: FeedbackRequest):
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        return {"feedback": "Your pronunciation is very clear! One tip: make sure to use the present continuous tense correctly when talking about ongoing actions (e.g., 'I am practicing' instead of 'I practice')."}

    try:
        import google.generativeai as genai
        genai.configure(api_key=gemini_key)
        # Using a model name that exists in this environment
        try:
            model = genai.GenerativeModel('models/gemini-3.1-flash-lite')
        except:
            model = genai.GenerativeModel('gemini-pro')
        
        full_conversation = "\n".join([f"{msg['role']}: {msg['text']}" for msg in req.conversation])
        
        prompt = f"""Analyze this English practice session. 
Be an encouraging, fun, and supportive coach! 

CRITICAL RULE: 
- DO NOT use any Markdown formatting. 
- DO NOT use hash symbols (#), stars (** or *), or greater-than symbols (>).
- Use ONLY plain text with double line breaks for spacing.

Format your response exactly like this (use the emojis):
🌟 TOP STRENGTHS:
[Point 1]

[Point 2]

🛠️ QUICK FIXES:
[Correction 1]

[Correction 2]

🔥 NEXT MISSION CHALLENGE:
[One small, fun specific goal]

Conversation:
{full_conversation}"""
        
        try:
            response = model.generate_content(prompt)
        except Exception as e:
            print(f"Gemini error: {e}, trying fallback")
            model = genai.GenerativeModel('models/gemini-3.1-flash-lite')
            response = model.generate_content(prompt)

        return {"feedback": response.text}
    except Exception as e:
        print("Gemini Feedback Exception:", str(e))
        return {"feedback": "Your pronunciation is very clear! One tip: make sure to use the present continuous tense correctly when talking about ongoing actions (e.g., 'I am practicing' instead of 'I practice')."}

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
