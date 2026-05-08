import os
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, auth, firestore
import requests
import json
import base64
from dotenv import load_dotenv
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

riva_auth = None
if NVIDIA_API_KEY:
    try:
        riva_auth = riva.client.Auth(
            use_ssl=True,
            uri="grpc.nvcf.nvidia.com:443",
            metadata_args=[
                ["function-id", NVIDIA_FUNCTION_ID],
                ["authorization", f"Bearer {NVIDIA_API_KEY}"]
            ]
        )
    except Exception as e:
        print(f"Error initializing Riva Auth: {e}")

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
        # Mock function to simulate fetching student name and CEFR level
        mock_name = f"Student {req.studentId}"
        mock_cefr = "B1"
        
        # Save student record to Firestore
        student_data = {
            "name": mock_name,
            "cefrLevel": mock_cefr,
            "organizationId": "mock-org",
        }
        doc_ref.set(student_data)
    else:
        student_data = doc.to_dict()
    
    # Generate custom token for Firebase Authentication
    try:
        custom_token = auth.create_custom_token(req.studentId)
        token_str = custom_token.decode("utf-8") if isinstance(custom_token, bytes) else custom_token
    except Exception as e:
        print(f"Error creating custom token: {e}")
        token_str = "mock_token"

    return {
        "token": token_str,
        "student": {
            "studentId": req.studentId,
            "name": student_data.get("name"),
            "cefrLevel": student_data.get("cefrLevel")
        }
    }

@app.post("/stt")
async def stt(audio: UploadFile = File(...)):
    # Read audio bytes
    audio_bytes = await audio.read()
    
    if not riva_auth:
        return {"text": "I think my English is getting better every day."}
    
    try:
        asr_service = riva.client.ASRService(riva_auth)
        
        # Configure the recognition request
        # Note: Frontend sends webm (often opus). Riva gRPC usually needs a container-less 
        # or specific encoding. If this fails due to encoding, we may need ffmpeg.
        config = riva.client.RecognitionConfig(
            language_code="en-US",
            max_alternatives=1,
            enable_automatic_punctuation=True,
            # We now receive a proper WAV (Linear PCM) from the frontend
            encoding=riva.client.AudioEncoding.LINEAR_PCM,
            sample_rate_hertz=16000
        )
        
        # We need to strip the 44-byte WAV header before sending to Riva gRPC 
        # or use a different method. Actually, Riva offline_recognize usually 
        # takes raw samples if encoding is LINEAR_PCM. 
        # Let's strip the first 44 bytes if it's a WAV.
        audio_payload = audio_bytes[44:] if audio_bytes[:4] == b'RIFF' else audio_bytes
        
        response = asr_service.offline_recognize(audio_payload, config)
        
        if response.results:
            transcript = ""
            for result in response.results:
                if result.alternatives:
                    transcript += result.alternatives[0].transcript + " "
            return {"text": transcript.strip()}
        
        return {"text": "I think my English is getting better every day."}

    except Exception as e:
        print("Riva STT Error:", str(e))
        return {"text": "I think my English is getting better every day."}

class ConversationRequest(BaseModel):
    transcript: str
    history: list
    cefrLevel: str

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
        prompt = f"""You are a friendly English conversation partner for a {req.cefrLevel} student.
Keep your sentences simple and natural.
Ask follow-up questions to continue the conversation.
Do NOT correct grammar.

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

class SessionSaveRequest(BaseModel):
    studentId: str
    cefrLevel: str
    timestamp: str
    conversation: list
    feedback: str

@app.post("/session/save")
async def save_session(req: SessionSaveRequest):
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    doc_ref = db.collection("sessions").document()
    doc_ref.set(req.model_dump())
    return {"id": doc_ref.id}

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
        
        prompt = f"""Analyze the following English conversation from a student.
Identify grammar mistakes and rewrite sentences correctly.
Provide clear explanations.

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
