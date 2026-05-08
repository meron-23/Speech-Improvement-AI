import requests
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.environ.get('HUGGINGFACE_API_KEY')
headers = {"Authorization": f"Bearer {api_key}"}

# Try a very common model
model_id = "gpt2"
url = f"https://api-inference.huggingface.co/models/{model_id}"
payload = {"inputs": "The meaning of life is"}

try:
    response = requests.get(url, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text[:200]}")
except Exception as e:
    print(f"Error: {e}")
