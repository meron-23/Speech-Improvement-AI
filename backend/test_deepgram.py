import requests

api_key = "a3d79ef2e476266b13409c0a388c571648777fa1"
url = "https://api.deepgram.com/v1/projects"

headers = {
    "Authorization": f"Token {api_key}"
}

print("Testing Deepgram API Key...")
try:
    response = requests.get(url, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error connecting: {e}")
