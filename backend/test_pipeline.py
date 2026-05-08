import os
import requests
import base64
import json
from dotenv import load_dotenv
import google.generativeai as genai
import riva.client

# Load environment variables
load_dotenv()

NVIDIA_API_KEY = os.environ.get('NVIDIA_API_KEY')
HUGGINGFACE_API_KEY = os.environ.get('HUGGINGFACE_API_KEY')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

def test_gemini():
    print("\n--- Testing Gemini LLM ---")
    if not GEMINI_API_KEY:
        print("Error: GEMINI_API_KEY not found.")
        return None
    
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model_name = 'models/gemini-3.1-flash-lite'
        print(f"Using model: {model_name}")
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Hello, how are you today?")
        print(f"Response: {response.text}")
        return response.text
    except Exception as e:
        print(f"Gemini Error: {e}")
        return None

def test_tts(text="Hello, this is a test of the free text to speech system."):
    print("\n--- Testing Free Google TTS ---")
    url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={text}&tl=en&client=tw-ob"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            with open("test_pipeline_tts.mp3", "wb") as f:
                f.write(response.content)
            print("Success! Audio saved to 'test_pipeline_tts.mp3'.")
            return True
        else:
            print(f"TTS Error ({response.status_code}): {response.text}")
            return False
    except Exception as e:
        print(f"TTS Exception: {e}")
        return False

def test_riva_stt():
    print("\n--- Testing NVIDIA Riva STT ---")
    if not NVIDIA_API_KEY:
        print("Error: NVIDIA_API_KEY not found.")
        return False
    
    function_id = "d3fe9151-442b-4204-a70d-5fcc597fd610"
    
    try:
        auth = riva.client.Auth(
            use_ssl=True,
            uri="grpc.nvcf.nvidia.com:443",
            metadata_args=[
                ["function-id", function_id],
                ["authorization", f"Bearer {NVIDIA_API_KEY}"]
            ]
        )
        asr_service = riva.client.ASRService(auth)
        print("Riva Auth and ASRService initialized successfully.")
        
        # We can't easily test transcription without a real audio file here,
        # but we can verify the connection by checking if the service responds to a dummy config.
        print("Testing Riva connection with empty audio...")
        try:
            config = riva.client.RecognitionConfig(
                language_code="en-US",
                encoding=riva.client.AudioEncoding.LINEAR_PCM,
                sample_rate_hertz=16000
            )
            # This should return an empty result or error out if connection fails
            asr_service.offline_recognize(b'\x00' * 3200, config) # 0.1s of silence
            print("Riva connection verified.")
            return True
        except Exception as e:
            print(f"Riva Recognition Error (expected if audio is invalid, but check message): {e}")
            if "unauthenticated" in str(e).lower():
                print("Check your NVIDIA_API_KEY and Function ID.")
            return False

    except Exception as e:
        print(f"Riva Initialization Error: {e}")
        return False

if __name__ == "__main__":
    print("Starting Pipeline Test...")
    
    llm_text = test_gemini()
    
    if llm_text:
        test_tts(llm_text)
    else:
        test_tts()
        
    test_riva_stt()
    
    print("\n--- Test Complete ---")
