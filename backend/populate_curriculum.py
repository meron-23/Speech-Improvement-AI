import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase
try:
    cred = credentials.Certificate("speech-improvement-ai-916685eed011.json")
    firebase_admin.initialize_app(cred)
except ValueError:
    # App already initialized
    pass

db = firestore.client()

# 1. Define the Curriculum
curriculum = [
    {
        "lessonId": "l1_meeting",
        "order": 1,
        "cefrLevel": "A1",
        "title": "The First Meeting",
        "objective": "Introduce yourself and ask 3 questions to your new neighbor.",
        "aiRole": "A friendly new neighbor named Alex.",
        "context": "You just moved in next door. You are carrying a box and look friendly.",
        "targetVocabulary": ["Nice to meet you", "Where are you from?", "How long", "Neighbor"]
    },
    {
        "lessonId": "l2_cafe",
        "order": 2,
        "cefrLevel": "A1",
        "title": "Coffee Run",
        "objective": "Order a drink and a snack, and pay for them.",
        "aiRole": "A barista at a busy downtown cafe.",
        "context": "The cafe is noisy. You need to ask for the customer's name for the cup.",
        "targetVocabulary": ["Can I have...", "Anything else?", "To go", "How much"]
    },
    {
        "lessonId": "l3_directions",
        "order": 3,
        "cefrLevel": "A2",
        "title": "Lost in the City",
        "objective": "Ask for directions to the train station and understand the answer.",
        "aiRole": "A helpful local person walking their dog.",
        "context": "You are standing on a street corner. You know the way to the station is two blocks down and turn left.",
        "targetVocabulary": ["Excuse me", "How do I get to...", "Turn left/right", "Straight ahead"]
    },
    {
        "lessonId": "l4_hotel",
        "order": 4,
        "cefrLevel": "A2",
        "title": "Checking In",
        "objective": "Check into your hotel room and ask about breakfast times.",
        "aiRole": "A professional hotel receptionist.",
        "context": "A guest is arriving late. You need their ID and tell them breakfast is from 7am to 10am.",
        "targetVocabulary": ["Reservation", "Check-in", "Breakfast", "Key card"]
    },
    {
        "lessonId": "l5_interview",
        "order": 5,
        "cefrLevel": "B1",
        "title": "The Job Interview",
        "objective": "Explain your previous work experience and why you are a good fit.",
        "aiRole": "A hiring manager at a creative agency.",
        "context": "You are looking for someone energetic. You will ask: 'Tell me about yourself'.",
        "targetVocabulary": ["Experience", "Responsible for", "Strength", "Opportunity"]
    },
    {
        "lessonId": "l6_negotiation",
        "order": 6,
        "cefrLevel": "B2",
        "title": "The Contract Negotiation",
        "objective": "Negotiate the terms of a new project, specifically the deadline and the budget.",
        "aiRole": "A tough but fair project client named Sarah.",
        "context": "The client wants the project done in 2 weeks for $5,000. You need to negotiate for 3 weeks and $6,000.",
        "targetVocabulary": ["Deadline", "Budget", "Terms and conditions", "Compromise"]
    },
    {
        "lessonId": "l7_ethics",
        "order": 7,
        "cefrLevel": "C1",
        "title": "Debating AI Ethics",
        "objective": "Present a nuanced argument about the impact of AI on human creativity.",
        "aiRole": "A skeptical university professor of philosophy.",
        "context": "The professor believes AI is the death of art. You need to argue that it's just a new tool.",
        "targetVocabulary": ["Nuanced", "Inherent", "Paradigm shift", "Counter-argument"]
    }
]

# 2. Upload Curriculum
print("Uploading curriculum...")
for lesson in curriculum:
    db.collection("curriculum").document(lesson["lessonId"]).set(lesson)
    print(f"  Added Lesson {lesson['order']}: {lesson['title']}")

# 3. Update Students based on their CEFR Level
print("\nUpdating test students for level-appropriate placement...")
placements = {
    "student001": "l1_meeting",    # A1
    "student002": "l3_directions", # A2
    "student003": "l5_interview"   # B1
}

for s_id, lesson_id in placements.items():
    doc_ref = db.collection("students").document(s_id)
    if doc_ref.get().exists:
        doc_ref.update({"currentLessonId": lesson_id})
        print(f"  Updated {s_id} to start at {lesson_id}")

print("\nDatabase update complete!")
