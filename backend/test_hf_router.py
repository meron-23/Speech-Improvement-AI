import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

# Use the key from .env
hf_token = os.environ.get("HUGGINGFACE_API_KEY")

if not hf_token:
    print("Error: HUGGINGFACE_API_KEY not found in .env")
    exit(1)

API_URL = "https://router.huggingface.co/fal-ai/fal-ai/kokoro/american-english"
headers = {
    "Authorization": f"Bearer {hf_token}",
}

def query(payload):
    print(f"Querying {API_URL}...")
    response = requests.post(API_URL, headers=headers, json=payload)
    print(f"Status Code: {response.status_code}")
    return response.json()

try:
    result = query({
        "text": "The answer to the universe is 42",
    })
    
    # Check if result contains audio or error
    if "error" in result:
        print(f"Error from API: {result['error']}")
    else:
        print("Success! Result keys:", result.keys())
        # The response likely contains 'audio' or similar. 
        # According to typical Fal.ai responses, it might be a URL or base64.
        # But the user's snippet suggests 'audio, sampling_rate = query(...)'.
        # However, .json() returns a dict or list.
        # If it's Kokoro, it might return a specific format.
        
        # Let's just print the whole result (limited)
        print(str(result)[:500])

except Exception as e:
    print(f"Exception: {e}")
