import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase
try:
    cred = credentials.Certificate("speech-improvement-ai-916685eed011.json")
    firebase_admin.initialize_app(cred)
except ValueError:
    pass

db = firestore.client()

def delete_collection(coll_ref, batch_size=50):
    docs = coll_ref.limit(batch_size).stream()
    deleted = 0
    for doc in docs:
        doc.reference.delete()
        deleted += 1
    if deleted >= batch_size:
        return delete_collection(coll_ref, batch_size)
    return deleted

# 1. Clear Sessions
print("Wiping 'sessions' collection...")
count = delete_collection(db.collection("sessions"))
print(f"  Deleted {count} sessions.")

# 2. Add Diverse Student Roster
print("\nPopulating students with diverse CEFR levels...")
students = [
    {"id": "student001", "name": "Anna (Beginner)", "level": "A1", "lesson": "l1_meeting", "streak": 0},
    {"id": "student002", "name": "Bob (Elementary)", "level": "A2", "lesson": "l3_directions", "streak": 0},
    {"id": "student003", "name": "Charlie (Intermediate)", "level": "B1", "lesson": "l5_interview", "streak": 0},
    {"id": "student004", "name": "David (Upper Int)", "level": "B2", "lesson": "l6_negotiation", "streak": 0},
    {"id": "student005", "name": "Elena (Advanced)", "level": "C1", "lesson": "l7_ethics", "streak": 0},
    {"id": "student006", "name": "Frank (Beginner)", "level": "A1", "lesson": "l1_meeting", "streak": 0},
    {"id": "student007", "name": "Grace (Intermediate)", "level": "B1", "lesson": "l5_interview", "streak": 0},
]

for s in students:
    db.collection("students").document(s["id"]).set({
        "name": s["name"],
        "cefrLevel": s["level"],
        "currentLessonId": s["lesson"],
        "practiceStreak": s["streak"],
        "organizationId": "meron-demo"
    })
    print(f"  Added {s['id']} ({s['level']}) starting at {s['lesson']}")

print("\nCleanup and population complete! You are ready to demo.")
