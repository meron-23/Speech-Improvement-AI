import os
import io
from dotenv import load_dotenv
from huggingface_hub import InferenceClient

load_dotenv()

# Use the key from .env
hf_token = os.environ.get("HUGGINGFACE_API_KEY")

if not hf_token:
    print("Error: HUGGINGFACE_API_KEY not found in .env")
    exit(1)

client = InferenceClient(
    provider="fal-ai",
    api_key=hf_token,
)

print("Testing Kokoro-82M TTS via InferenceClient (provider=fal-ai)...")

try:
    # audio is returned as bytes
    audio = client.text_to_speech(
        "The answer to the universe is 42",
        model="hexgrad/Kokoro-82M",
    )

    with open("test_kokoro.wav", "wb") as f:
        f.write(audio)

    print("Success! Audio saved to 'test_kokoro.wav'.")
except Exception as e:
    print(f"Error during TTS: {e}")
