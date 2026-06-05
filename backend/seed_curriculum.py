import firebase_admin
from firebase_admin import credentials, firestore
import json
import os

# Initialize Firebase
try:
    cred = credentials.Certificate("speech-improvement-ai-916685eed011.json")
    firebase_admin.initialize_app(cred)
except ValueError:
    pass

db = firestore.client()

# 1. Load A1 parsed curriculum
a1_file = "a1_parsed_curriculum.json"
a1_lessons = []
if os.path.exists(a1_file):
    with open(a1_file, "r", encoding="utf-8") as f:
        a1_lessons = json.load(f)

# 2. Define Mock Data for other levels (A2, B1, B2, C1)
mock_lessons = [
    # A2 - Module 1
    {
        "lessonId": "a2_m1_1_directions",
        "cefrLevel": "A2",
        "moduleId": "a2_m1",
        "moduleTitle": "Travel & Directions",
        "moduleOrder": 1,
        "taskOrder": 1,
        "title": "Lost in the City",
        "objective": "Ask for directions to the train station and understand the answer.",
        "aiRole": "A helpful local person walking their dog.",
        "context": "You are standing on a street corner. You know the way to the station is two blocks down and turn left.",
        "targetVocabulary": ["Excuse me", "How do I get to...", "Turn left/right", "Straight ahead"]
    },
    {
        "lessonId": "a2_m1_2_hotel",
        "cefrLevel": "A2",
        "moduleId": "a2_m1",
        "moduleTitle": "Travel & Directions",
        "moduleOrder": 1,
        "taskOrder": 2,
        "title": "Checking In",
        "objective": "Check into your hotel room and ask about breakfast times.",
        "aiRole": "A professional hotel receptionist.",
        "context": "A guest is arriving late. You need their ID and tell them breakfast is from 7am to 10am.",
        "targetVocabulary": ["Reservation", "Check-in", "Breakfast", "Key card"]
    },
    # B1 - Module 1
    {
        "lessonId": "b1_m1_1_interview",
        "cefrLevel": "B1",
        "moduleId": "b1_m1",
        "moduleTitle": "Career & Office",
        "moduleOrder": 1,
        "taskOrder": 1,
        "title": "The Job Interview",
        "objective": "Explain your previous work experience and why you are a good fit.",
        "aiRole": "A hiring manager at a creative agency.",
        "context": "You are looking for someone energetic. You will ask: 'Tell me about yourself'.",
        "targetVocabulary": ["Experience", "Responsible for", "Strength", "Opportunity"]
    },
    {
        "lessonId": "b1_m1_2_meeting",
        "cefrLevel": "B1",
        "moduleId": "b1_m1",
        "moduleTitle": "Career & Office",
        "moduleOrder": 1,
        "taskOrder": 2,
        "title": "Project Brainstorm",
        "objective": "Share an idea for a new project and ask for feedback.",
        "aiRole": "A supportive but critical team colleague.",
        "context": "You are in a meeting room brainstorming ideas for a new marketing campaign.",
        "targetVocabulary": ["Idea", "Feedback", "What do you think", "Suggest"]
    },
    # B2 - Module 1
    {
        "lessonId": "b2_m1_1_negotiation",
        "cefrLevel": "B2",
        "moduleId": "b2_m1",
        "moduleTitle": "Business Communications",
        "moduleOrder": 1,
        "taskOrder": 1,
        "title": "Contract Negotiation",
        "objective": "Negotiate the terms of a new project, specifically the deadline and the budget.",
        "aiRole": "A tough but fair project client named Sarah.",
        "context": "The client wants the project done in 2 weeks for $5,000. You need to negotiate for 3 weeks and $6,000.",
        "targetVocabulary": ["Deadline", "Budget", "Terms and conditions", "Compromise"]
    },
    # C1 - Module 1
    {
        "lessonId": "c1_m1_1_ethics",
        "cefrLevel": "C1",
        "moduleId": "c1_m1",
        "moduleTitle": "Complex Discussions",
        "moduleOrder": 1,
        "taskOrder": 1,
        "title": "Debating AI Ethics",
        "objective": "Present a nuanced argument about the impact of AI on human creativity.",
        "aiRole": "A skeptical university professor of philosophy.",
        "context": "The professor believes AI is the death of art. You need to argue that it's just a new tool.",
        "targetVocabulary": ["Nuanced", "Inherent", "Paradigm shift", "Counter-argument"]
    }
]

# 3. Combine and re-index global order
curriculum = a1_lessons + mock_lessons
for i, lesson in enumerate(curriculum):
    lesson["order"] = i + 1

# 4. Clear Existing Curriculum
print("Clearing existing curriculum collection...")
docs = db.collection("curriculum").stream()
count = 0
for doc in docs:
    doc.reference.delete()
    count += 1
print(f"Deleted {count} old lessons.")

# 5. Upload New Curriculum
print(f"\nUploading {len(curriculum)} new structured curriculum tasks...")
for lesson in curriculum:
    db.collection("curriculum").document(lesson["lessonId"]).set(lesson)
    print(f"  Added [{lesson['cefrLevel']}] Task {lesson['order']}: {lesson.get('title', 'Untitled')}")

# 6. Update Students to point to valid lessons based on their CEFR Level
print("\nUpdating students for level-appropriate placement...")
students = db.collection("students").stream()
for s in students:
    s_data = s.to_dict()
    level = s_data.get("cefrLevel", "A1")
    
    first_lesson = next((l for l in curriculum if l["cefrLevel"] == level), None)
    
    if first_lesson:
        db.collection("students").document(s.id).update({
            "currentLessonId": first_lesson["lessonId"],
            "levelComplete": False
        })
        print(f"  Updated student {s.id} to start at {first_lesson['lessonId']} ({level})")

print("\nDatabase curriculum seeding complete!")
