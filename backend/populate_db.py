import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate("speech-improvement-ai-916685eed011.json")
firebase_admin.initialize_app(cred)

db = firestore.client()

students = [
    {"studentId": "student001", "name": "Alice (A2)", "cefrLevel": "A2"},
    {"studentId": "student002", "name": "Bob (B1)", "cefrLevel": "B1"},
    {"studentId": "student003", "name": "Charlie (B2)", "cefrLevel": "B2"}
]

for student in students:
    doc_ref = db.collection("students").document(student["studentId"])
    doc_ref.set(student)
    print(f"Inserted student: {student['studentId']}")

print("Database population complete!")
