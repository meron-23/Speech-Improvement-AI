import os
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase app
if not firebase_admin._apps:
    firebase_service_account = os.getenv('FIREBASE_SERVICE_ACCOUNT')
    if firebase_service_account:
        cred = credentials.Certificate(json.loads(firebase_service_account))
    else:
        cred = credentials.Certificate('speech-improvement-ai-916685eed011.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

student_id = 'student001'

# Update the student document to set levelComplete to True
doc_ref = db.collection('students').document(student_id)
doc_ref.update({'levelComplete': True})
print(f"Set levelComplete=true for {student_id}")
