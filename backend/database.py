import os
import json
import firebase_admin
from firebase_admin import credentials, firestore

db = None

try:
    if not firebase_admin._apps:
        firebase_service_account = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
        firebase_creds_path = os.environ.get("FIREBASE_CREDENTIALS_PATH", "speech-improvement-ai-916685eed011.json")
        
        if firebase_service_account:
            service_account_info = json.loads(firebase_service_account)
            cred = credentials.Certificate(service_account_info)
        elif os.path.exists(firebase_creds_path):
            cred = credentials.Certificate(firebase_creds_path)
        else:
            print("Warning: No Firebase credentials provided via environment or file.")
            cred = None
            
        if cred:
            firebase_admin.initialize_app(cred)
            
    db = firestore.client() if firebase_admin._apps else None
except Exception as e:
    print(f"Error initializing Firebase: {e}")
    db = None
