import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase
try:
    cred = credentials.Certificate("speech-improvement-ai-916685eed011.json")
    firebase_admin.initialize_app(cred)
except ValueError:
    pass

db = firestore.client()

print("=== Current Curriculum in Firestore ===\n")
docs = db.collection("curriculum").stream()
docs_list = list(docs)

if not docs_list:
    print("No documents found in 'curriculum' collection.")
else:
    print(f"Total documents: {len(docs_list)}\n")
    for doc in docs_list:
        data = doc.to_dict()
        print(f"Document ID: {doc.id}")
        print(f"  Title: {data.get('title', 'N/A')}")
        print(f"  Module: {data.get('moduleTitle', data.get('cefrLevel', 'N/A'))}")
        print(f"  CEFR Level: {data.get('cefrLevel', 'N/A')}")
        has_questions = 'questions' in data and len(data.get('questions', [])) > 0
        print(f"  Has Questions: {has_questions} ({len(data.get('questions', []))} questions)")
        print()
