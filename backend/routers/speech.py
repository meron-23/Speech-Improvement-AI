import os
import re
import base64
import asyncio
import uuid
import io
import requests
import edge_tts
from gtts import gTTS
from fastapi import APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect, Depends
from pydantic import BaseModel
import jwt
from config import JWT_SECRET, GEMINI_API_KEY, GROQ_API_KEY, DEEPGRAM_API_KEY, ADDIS_API_KEY
from auth_utils import verify_student_token

router = APIRouter(tags=["speech"])

LATIN_AMHARIC_PATTERN = re.compile(
    r'\b(selam|endemin|endeet|endet|algebanyem|algebangem|eshi|ishe|ante|anchi|betam|tiru|dehna|amesegnalehu|amesegnalew|yikirta|min|ayt|aydelem|ayhonim|man|ene|egna|ahun|kebad|kelela|konjo|gobez|ayzo|ayzoh|ayzosh|bado|chigir|yelem)\b',
    re.IGNORECASE
)

def generate_addis_tts(text: str, voice_id: str = "am-simon") -> str:
    """
    Generate speech audio via Addis Assistant TTS API (Addis Voices 2).
    Returns data URI string (e.g. data:audio/mpeg;base64,...) or empty string.
    Voices:
      - am-simon: Male Amharic voice
      - am-hamen: Female Amharic voice
    """
    if not ADDIS_API_KEY:
        return ""
    try:
        url = "https://api.addisassistant.com/api/v1/voice/generations"
        headers = {
            "x-api-key": ADDIS_API_KEY,
            "content-type": "application/json"
        }
        payload = {
            "text": text,
            "voice_id": voice_id,
            "language": "am",
            "output_format": "mp3_44100",
            "client_request_id": str(uuid.uuid4())
        }
        res = requests.post(url, headers=headers, json=payload, timeout=15)
        if res.status_code == 201:
            data = res.json().get("data", {})
            return data.get("audio", "")
        else:
            print(f"[ADDIS_TTS] Error {res.status_code}: {res.text}")
    except Exception as e:
        print(f"[ADDIS_TTS] Exception: {e}")
    return ""


# ──────────────────────────────────────────────────────────────
# Microsoft Edge Neural TTS (edge-tts) — zero-cost, high quality
# ──────────────────────────────────────────────────────────────
# Voice mapping:
#   English Male   → en-US-GuyNeural
#   English Female → en-US-JennyNeural
#   Amharic Male   → am-ET-AmehaNeural
#   Amharic Female → am-ET-MekdesNeural

EDGE_VOICES = {
    "en_male":   "en-US-GuyNeural",
    "en_female": "en-US-JennyNeural",
    "am_male":   "am-ET-AmehaNeural",
    "am_female": "am-ET-MekdesNeural",
}

async def get_edge_audio_bytes(text: str, voice: str, timeout: float = 3.5) -> bytes:
    try:
        async def _stream():
            communicate = edge_tts.Communicate(text, voice)
            audio_data = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data.extend(chunk["data"])
            return bytes(audio_data)
        return await asyncio.wait_for(_stream(), timeout=timeout)
    except Exception as e:
        print(f"[EDGE_TTS] Failed for voice '{voice}': {e}")
        return b""

def generate_gtts_english(text: str) -> bytes:
    """
    Fallback English TTS using Google Translate TTS (gTTS).
    Returns MP3 bytes, or empty bytes on failure.
    """
    try:
        buf = io.BytesIO()
        tts = gTTS(text=text, lang='en', slow=False)
        tts.write_to_fp(buf)
        buf.seek(0)
        audio_bytes = buf.read()
        print(f"[GTTS] Fallback synthesis succeeded ({len(audio_bytes)} bytes)")
        return audio_bytes
    except Exception as e:
        print(f"[GTTS] Fallback failed: {e}")
        return b""

async def generate_edge_tts(text: str, voice: str) -> str:
    """
    Synthesize text with Microsoft Edge Neural TTS.
    Returns base64-encoded MP3 string, or empty string on failure.
    """
    audio_bytes = await get_edge_audio_bytes(text, voice)
    if audio_bytes:
        return base64.b64encode(audio_bytes).decode("utf-8")
    return ""

def split_by_language(text: str):
    """
    Splits text into chunks of (lang, text) where lang is 'am' or 'en'.
    Preserves natural sentence boundaries.
    """
    sentences = re.split(r'(?<=[.!?\u1362\n])\s+', text.strip())
    segments = []
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        has_am = bool(re.search(r'[\u1200-\u137F\u1380-\u139F]', s))
        has_en = bool(re.search(r'[a-zA-Z]', s))
        if has_am and not has_en:
            segments.append(('am', s))
        elif has_en and not has_am:
            segments.append(('en', s))
        else:
            # Sentence contains both scripts: split at Amharic boundary
            sub_parts = re.split(r'([\u1200-\u137F\u1380-\u139F]+[^\na-zA-Z]*)', s)
            for p in sub_parts:
                p = p.strip()
                if not p:
                    continue
                if re.search(r'[\u1200-\u137F\u1380-\u139F]', p):
                    segments.append(('am', p))
                else:
                    segments.append(('en', p))
    merged = []
    for lang, part in segments:
        if merged and merged[-1][0] == lang:
            merged[-1] = (lang, merged[-1][1] + ' ' + part)
        else:
            merged.append((lang, part))
    return merged

async def synthesize_tutor_speech(text: str, voice_gender: str = "male") -> str:
    """
    Intelligently synthesize speech for the AI tutor:
    - Pure English: native English Neural voice (Guy / Jenny)
    - Pure Amharic: native Amharic Neural voice (Ameha / Mekdes), Addis fallback
    - Bilingual (Amharic + English): split sentences, synthesize Amharic with Amharic voice
      and English with English voice in parallel, then seamlessly stitch the MP3 streams together.
    Returns base64-encoded MP3 string.
    """
    if not text or not text.strip():
        return ""

    is_female = str(voice_gender).lower() == "female"
    en_voice = EDGE_VOICES["en_female"] if is_female else EDGE_VOICES["en_male"]
    am_voice = EDGE_VOICES["am_female"] if is_female else EDGE_VOICES["am_male"]
    addis_voice = "am-hamen" if is_female else "am-simon"

    has_am = bool(re.search(r'[\u1200-\u137F\u1380-\u139F]', text))
    has_en = bool(re.search(r'[a-zA-Z]', text))

    if has_en and not has_am:
        # Pure English — try edge-tts, fall back to gTTS
        audio = await get_edge_audio_bytes(text, en_voice, timeout=3.5)
        if not audio:
            print("[TTS] edge-tts failed for English, falling back to gTTS")
            audio = await asyncio.get_event_loop().run_in_executor(None, generate_gtts_english, text)
        return base64.b64encode(audio).decode("utf-8") if audio else ""

    if has_am and not has_en:
        # Pure Amharic
        audio = await get_edge_audio_bytes(text, am_voice, timeout=2.5)
        if audio:
            return base64.b64encode(audio).decode("utf-8")
        if ADDIS_API_KEY:
            addis_res = generate_addis_tts(text, voice_id=addis_voice)
            if addis_res:
                return addis_res.split(",", 1)[1] if "," in addis_res else addis_res
        return ""

    # Bilingual: synthesize all segments in parallel to minimize latency
    segments = split_by_language(text)

    async def fetch_segment_audio(lang: str, seg_text: str) -> bytes:
        if lang == 'am':
            seg_audio = await get_edge_audio_bytes(seg_text, am_voice, timeout=2.5)
            if not seg_audio and ADDIS_API_KEY:
                addis_res = generate_addis_tts(seg_text, voice_id=addis_voice)
                if addis_res:
                    b64 = addis_res.split(",", 1)[1] if "," in addis_res else addis_res
                    try:
                        seg_audio = base64.b64decode(b64)
                    except Exception:
                        seg_audio = b""
            return seg_audio
        else:
            # English segment — try edge-tts, fall back to gTTS
            seg_audio = await get_edge_audio_bytes(seg_text, en_voice, timeout=3.5)
            if not seg_audio:
                print("[TTS] edge-tts failed for English segment, falling back to gTTS")
                seg_audio = await asyncio.get_event_loop().run_in_executor(None, generate_gtts_english, seg_text)
            return seg_audio

    segment_audios = await asyncio.gather(*(fetch_segment_audio(l, t) for l, t in segments))
    combined = bytearray()
    for seg_audio in segment_audios:
        if seg_audio:
            combined.extend(seg_audio)

    return base64.b64encode(bytes(combined)).decode("utf-8") if combined else ""


MAX_CHUNK_SIZE = 200

@router.post("/stt")
async def stt(audio: UploadFile = File(...), current_student: str = Depends(verify_student_token)):
    audio_bytes = await audio.read()
    if len(audio_bytes) < 1500:
        print(f"DEBUG: Audio file too small for transcription: {len(audio_bytes)} bytes")
        return {"text": ""}
    
    try:
        print(f"DEBUG: Received audio file. Size: {len(audio_bytes)} bytes")
        import google.generativeai as genai
        if not GEMINI_API_KEY:
            return {"text": ""}

        genai.configure(api_key=GEMINI_API_KEY)
        
        print("DEBUG: Transcribing with Gemini...")
        model = genai.GenerativeModel('gemini-3.1-flash-lite')
        response = model.generate_content([
            {"mime_type": audio.content_type or "audio/webm", "data": audio_bytes}, 
            "Transcribe human speech in this audio accurately. The speaker is an Ethiopian student who may speak in English or Amharic. If they speak Amharic, transcribe in Amharic Ge'ez script (ፊደል). If they speak English, transcribe in English. Return ONLY the exact words spoken. If there is no clear speech, background noise only, silence, music, or you are unsure, return an empty string. DO NOT converse with me. DO NOT ask for the audio file or a link. Never apologize or explain. If you cannot transcribe it, return an empty string."
        ], generation_config={"temperature": 0})

        
        if response.text:
            transcript = response.text.strip()
            no_speech_markers = [
                "no clear speech", "no speech", "silence", "background noise",
                "empty string", "inaudible", "unclear", "i'm sorry", "i cannot",
                "i can't", "there is no", "nothing to transcribe", "please provide the audio",
                "link to the audio", "audio file or a link", "would you like me to transcribe",
                "provide the audio file"
            ]
            
            exact_match_hallucinations = {
                "thank you", "thanks for watching", "thank you for watching",
                "please subscribe", "subscribe to the channel", "okay",
                "yes", "yeah", "amen", "bye"
            }
            
            normalized_transcript = transcript.lower().strip(" .!\"'`")
            if (
                not normalized_transcript
                or normalized_transcript in {"", "''", '""', "n/a", "none"}
                or normalized_transcript in exact_match_hallucinations
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

@router.post("/conversation")
async def conversation(req: ConversationRequest, current_student: str = Depends(verify_student_token)):
    if not GROQ_API_KEY:
        return {"text": "That is wonderful to hear! Consistent practice is the key to improvement."}

    try:
        from groq import Groq
        groq_client = Groq(api_key=GROQ_API_KEY)
        
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
        
        # Try Groq with available models
        for model_name in ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]:
            try:
                response = groq_client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=150,
                )
                return {"text": response.choices[0].message.content}
            except Exception as me:
                print(f"Groq {model_name} failed: {me}")
                continue

        # Fallback to Gemini if Groq fails
        if GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=GEMINI_API_KEY)
                g_model = genai.GenerativeModel("gemini-2.5-flash")
                gemini_prompt = f"{system_prompt}\nStudent says: {req.transcript}"
                g_res = g_model.generate_content(gemini_prompt)
                if g_res.text:
                    return {"text": g_res.text.strip()}
            except Exception as ge:
                print(f"Gemini conversation fallback failed: {ge}")

        return {"text": "That is wonderful to hear! Consistent practice is the key to improvement."}
    except Exception as e:
        print("Groq Exception:", str(e))
        return {"text": "That is wonderful to hear! Consistent practice is the key to improvement."}

class TTSRequest(BaseModel):
    text: str
    voice_gender: str = "male"
    voice_id: str = None

@router.post("/tts")
async def tts(req: TTSRequest, current_student: str = Depends(verify_student_token)):
    audio_b64 = await synthesize_tutor_speech(req.text, voice_gender=req.voice_gender)
    if audio_b64:
        return {"audio": audio_b64, "format": "mp3"}

    print("[TTS] All synthesis paths failed, returning empty.")
    return {"audio": ""}


@router.websocket("/chat_stream")
async def chat_stream(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if token:
        try:
            jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except Exception:
            await websocket.close(code=1008)
            return

    await websocket.accept()
    
    if not GROQ_API_KEY:
        await websocket.close(code=1008)
        return
        
    from groq import Groq
    groq_client = Groq(api_key=GROQ_API_KEY)
    
    try:
        while True:
            payload = await websocket.receive_json()
            msg_type = payload.get("type")
            print(f"[CHAT_STREAM] Received message type: {msg_type}")
            
            if msg_type == "ping":
                continue
                
            is_start = (msg_type == "start")
            transcript = payload.get("transcript")
            
            if not transcript and not is_start:
                continue
                
            if transcript:
                print(f"[CHAT_STREAM] User transcript: {transcript}")
                await websocket.send_json({"type": "transcript", "text": transcript})
            
            history = payload.get("history", [])
            cefrLevel = payload.get("cefrLevel", "B1")
            lesson = payload.get("lesson")
            voice_gender = payload.get("voiceGender", "male")
            target_voice_id = "am-hamen" if str(voice_gender).lower() == "female" else "am-simon"
            
            is_amharic = payload.get("isAmharic", False)
            if transcript:
                has_latin_amharic = bool(LATIN_AMHARIC_PATTERN.search(transcript))
                has_geez_script = bool(re.search(r'[\u1200-\u137F\u1380-\u139F]', transcript))
                if has_latin_amharic or has_geez_script:
                    is_amharic = True
            
            system_prompt = f"You are a friendly English conversation partner for a {cefrLevel} student."
            if lesson:
                system_prompt = f"""You are playing a role for a lesson: '{lesson.get('title')}'.
Your Role: {lesson.get('aiRole')}
The Context: {lesson.get('context')}
The Student's Objective: {lesson.get('objective')}
Stay in character and help the student achieve their objective through conversation."""

            if is_start:
                system_prompt += "\n\nThis is the very beginning of the conversation. Start the roleplay by greeting the student naturally according to the context and your role. Keep it short and engaging!"

            if cefrLevel in ("A1", "A2"):
                length_rule = (
                    "RESPONSE LENGTH (STRICT): You are speaking with a BEGINNER. "
                    "Respond in 1–2 very short, simple sentences MAXIMUM. "
                    "Use only basic, everyday vocabulary. Never write a paragraph."
                )
            elif cefrLevel in ("B1", "B2"):
                length_rule = (
                    "RESPONSE LENGTH: Keep responses to 2–3 sentences. "
                    "Use natural conversational English with common vocabulary."
                )
            else:
                length_rule = "RESPONSE LENGTH: Keep responses concise, 2–3 sentences at most."

            system_prompt += f"""
{length_rule}

ABSOLUTE RULES (never break these):
- NEVER include stage directions, gestures, or actions such as *smiles*, *nods*, *laughs*, *sighs*, or any text wrapped in asterisks (*...*). Speak only in plain words.
- Do NOT correct the student's grammar during the conversation; keep the flow going.
- Ask one short follow-up question to keep the conversation moving.
"""

            # If student spoke Amharic (in Fidel or Latin transliteration), override with a bilingual teaching response
            if is_amharic:
                system_prompt += """

IMPORTANT — AMHARIC INPUT DETECTED:
The student communicated in Amharic (either in Ge'ez Fidel or Latin transliteration / Amharish like 'selam', 'algebanyem', 'endeet neh', etc.).
They understand Amharic but are building English speaking confidence.
Your job is to act as a warm bilingual tutor:
1. First, briefly acknowledge what they said in Amharic Fidel (1 short sentence in Amharic script, e.g. "ጥሩ ነው!", "እሺ!", "አልገባኝም አልክ? ችግር የለም!").
2. Then show them clearly how to express that exact idea in English — give 1 or 2 natural phrases.
3. End with a gentle English prompt encouraging them to try saying it (e.g. "Can you try saying that in English?").

Format: [Amharic acknowledgment in Fidel]. In English, you could say: "[English phrase 1]" or "[English phrase 2]". [Gentle prompt to try in English].
Keep the whole response under 3 sentences. Be warm and encouraging, not corrective.
"""
            messages = [{"role": "system", "content": system_prompt}]
            for msg in history:
                role = "assistant" if msg["role"] == "ai" else "user"
                messages.append({"role": role, "content": msg["text"]})
            if transcript:
                messages.append({"role": "user", "content": transcript})
            elif is_start:
                messages.append({
                    "role": "user",
                    "content": "Hello! Please start our conversation roleplay according to your role and context."
                })
            
            try:
                print(f"[CHAT_STREAM] Calling Groq with {len(messages)} messages (is_amharic={is_amharic}, voice={target_voice_id})...")
                full_ai_text = None
                for model_name in ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]:
                    try:
                        response = groq_client.chat.completions.create(
                            model=model_name,
                            messages=messages,
                            temperature=0.7,
                            max_tokens=120,
                        )
                        if response.choices and response.choices[0].message.content:
                            raw_ai_text = response.choices[0].message.content
                            cleaned = re.sub(r'\*[^*]+\*', '', raw_ai_text).strip()
                            cleaned = re.sub(r'  +', ' ', cleaned).strip()
                            if cleaned:
                                full_ai_text = cleaned
                                break
                    except Exception as me:
                        print(f"[CHAT_STREAM] Groq model {model_name} failed: {me}")
                        continue

                # Fallback to Gemini if Groq models fail
                if not full_ai_text and GEMINI_API_KEY:
                    try:
                        import google.generativeai as genai
                        genai.configure(api_key=GEMINI_API_KEY)
                        g_model = genai.GenerativeModel("gemini-2.5-flash")
                        gemini_history_text = "\n".join([f"{m['role']}: {m['content']}" for m in messages])
                        g_res = g_model.generate_content(gemini_history_text)
                        if g_res.text:
                            raw_ai_text = g_res.text.strip()
                            cleaned = re.sub(r'\*[^*]+\*', '', raw_ai_text).strip()
                            cleaned = re.sub(r'  +', ' ', cleaned).strip()
                            if cleaned:
                                full_ai_text = cleaned
                    except Exception as ge:
                        print(f"[CHAT_STREAM] Gemini fallback failed: {ge}")

                if not full_ai_text:
                    full_ai_text = "Hello! I'm your English conversation partner. How are you doing today?"

                print(f"[CHAT_STREAM] Groq/Gemini response: {full_ai_text}")
                await websocket.send_json({"type": "text", "text": full_ai_text})

                # ── Synthesize tutor speech (English, Amharic, or bilingual stitched) ──
                turn_audio = await synthesize_tutor_speech(full_ai_text, voice_gender=voice_gender)

                done_payload = {"type": "done", "full_text": full_ai_text.strip()}
                if turn_audio:
                    done_payload["audio"] = turn_audio
                await websocket.send_json(done_payload)


            except Exception as generation_err:
                print(f"[CHAT_STREAM] Error during Groq generation: {generation_err}")
                fallback_msg = "I'm having a bit of trouble connecting right now. Please try again!"
                await websocket.send_json({"type": "text", "text": fallback_msg})
                await websocket.send_json({"type": "done", "full_text": fallback_msg})
                
    except WebSocketDisconnect:
        print("[CHAT_STREAM] WebSocket Client disconnected")
    except Exception as e:
        print(f"[CHAT_STREAM] WebSocket Exception: {e}")

@router.get("/auth/deepgram")
async def get_deepgram_token(current_student: str = Depends(verify_student_token)):
    if not DEEPGRAM_API_KEY:
        raise HTTPException(status_code=500, detail="Deepgram API key not configured")
    return {"key": DEEPGRAM_API_KEY}
