import requests
import base64

def test_free_tts(text="Hello! This is a free text to speech test."):
    print(f"Testing free Google Translate TTS for: {text}")
    url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={text}&tl=en&client=tw-ob"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            with open("test_free_tts.mp3", "wb") as f:
                f.write(response.content)
            print("Success! Audio saved to 'test_free_tts.mp3'.")
            return True
        else:
            print(f"Error ({response.status_code}): {response.text}")
            return False
    except Exception as e:
        print(f"Exception: {e}")
        return False

if __name__ == "__main__":
    test_free_tts()
