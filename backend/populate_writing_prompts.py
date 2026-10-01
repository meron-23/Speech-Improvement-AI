import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import db

INITIAL_WRITING_PROMPTS = [
    # A1 - Beginner
    {
        "id": "a1-daily-routine",
        "level": "A1",
        "category": "Daily Life",
        "title": "My Daily Routine",
        "instructions": "Describe what you usually do every day from morning until night. Write about your wake-up time, meals, and favorite activities.",
        "targetWords": "50 - 100 words",
        "minWords": 30,
        "keywords": ["morning", "breakfast", "school / work", "evening", "sleep"],
        "order": 1
    },
    {
        "id": "a1-favorite-food",
        "level": "A1",
        "category": "Daily Life",
        "title": "My Favorite Food",
        "instructions": "What is your favorite dish or food? Describe what it tastes like, when you eat it, and why you love it.",
        "targetWords": "40 - 80 words",
        "minWords": 25,
        "keywords": ["delicious", "cook", "ingredients", "family", "taste"],
        "order": 2
    },
    {
        "id": "a1-best-friend",
        "level": "A1",
        "category": "Storytelling",
        "title": "My Best Friend",
        "instructions": "Introduce your best friend. What do they look like? What is their personality, and what do you like doing together?",
        "targetWords": "50 - 100 words",
        "minWords": 30,
        "keywords": ["kind", "funny", "together", "hobbies", "friendship"],
        "order": 3
    },

    # A2 - Elementary
    {
        "id": "a2-last-vacation",
        "level": "A2",
        "category": "Storytelling",
        "title": "A Memorable Vacation or Trip",
        "instructions": "Write about a trip or vacation you took in the past. Where did you go, who did you go with, and what was the most exciting thing that happened?",
        "targetWords": "80 - 150 words",
        "minWords": 50,
        "keywords": ["traveled", "visited", "weather", "memorable", "experience"],
        "order": 4
    },
    {
        "id": "a2-invitation-email",
        "level": "A2",
        "category": "Workplace & Emails",
        "title": "Inviting a Friend to a Celebration",
        "instructions": "Write a friendly email inviting someone to your birthday party or a holiday celebration. Include date, time, location, and activities.",
        "targetWords": "70 - 120 words",
        "minWords": 40,
        "keywords": ["celebrate", "party", "location", "join us", "hope to see you"],
        "order": 5
    },
    {
        "id": "a2-why-learn-english",
        "level": "A2",
        "category": "Reflective",
        "title": "Why I Am Learning English",
        "instructions": "Explain your personal goals for learning English. How will speaking and writing in English help your future, studies, or career?",
        "targetWords": "80 - 140 words",
        "minWords": 50,
        "keywords": ["goals", "future", "opportunity", "practice", "communicate"],
        "order": 6
    },

    # B1 - Intermediate
    {
        "id": "b1-school-homework",
        "level": "B1",
        "category": "Opinion & Debates",
        "title": "Should Homework Be Banned?",
        "instructions": "Argue whether school students should receive daily homework or if learning should stay strictly in the classroom. Provide reasons for both sides and conclude with your opinion.",
        "targetWords": "120 - 220 words",
        "minWords": 80,
        "keywords": ["academic", "pressure", "independent learning", "balance", "conclusion"],
        "order": 7
    },
    {
        "id": "b1-hotel-complaint",
        "level": "B1",
        "category": "Workplace & Emails",
        "title": "Formal Email to a Hotel Manager",
        "instructions": "Write a polite but firm formal email complaining about unexpected problems during a recent hotel stay (e.g. noisy air conditioner, missing reservations) and request compensation or a refund.",
        "targetWords": "120 - 200 words",
        "minWords": 70,
        "keywords": ["disappointed", "inconvenience", "resolution", "regards", "assistance"],
        "order": 8
    },
    {
        "id": "b1-dream-career",
        "level": "B1",
        "category": "Reflective",
        "title": "My Dream Career & Impact",
        "instructions": "Describe the career or profession you aspire to pursue. What skills do you need to develop, and how will your work benefit your community or the world?",
        "targetWords": "130 - 220 words",
        "minWords": 80,
        "keywords": ["aspiration", "skills", "community", "passion", "dedication"],
        "order": 9
    },

    # B2 - Upper Intermediate
    {
        "id": "b2-remote-work",
        "level": "B2",
        "category": "Opinion & Debates",
        "title": "Remote Work vs. Traditional Office",
        "instructions": "Analyze the shift towards remote and hybrid work. Discuss productivity, psychological well-being, and social isolation. Give your perspective on the future of work.",
        "targetWords": "180 - 300 words",
        "minWords": 120,
        "keywords": ["productivity", "flexibility", "isolation", "collaboration", "work-life balance"],
        "order": 10
    },
    {
        "id": "b2-social-media-impact",
        "level": "B2",
        "category": "Opinion & Debates",
        "title": "The Impact of Social Media on Modern Youth",
        "instructions": "Evaluate whether social media platforms foster genuine human connection or contribute to loneliness and unrealistic standards. Present balanced arguments supported by examples.",
        "targetWords": "180 - 300 words",
        "minWords": 120,
        "keywords": ["connectivity", "mental health", "superficial", "algorithms", "perspective"],
        "order": 11
    },
    {
        "id": "b2-job-application-cover-letter",
        "level": "B2",
        "category": "Workplace & Emails",
        "title": "Professional Cover Letter",
        "instructions": "Draft a compelling cover letter applying for a leadership or technical role at an international organization. Highlight your key accomplishments, leadership style, and enthusiasm.",
        "targetWords": "180 - 280 words",
        "minWords": 110,
        "keywords": ["leadership", "qualifications", "contribution", "initiative", "sincerely"],
        "order": 12
    },

    # C1 / C2 - Advanced
    {
        "id": "c1-ai-ethics",
        "level": "C1",
        "category": "Opinion & Debates",
        "title": "Can AI Replicate Human Creativity?",
        "instructions": "Critically analyze whether generative artificial intelligence can produce authentic art, literature, and philosophical insights, or whether true creativity requires human consciousness and emotional depth.",
        "targetWords": "250 - 450 words",
        "minWords": 150,
        "keywords": ["authenticity", "consciousness", "algorithmic", "nuance", "aesthetic"],
        "order": 13
    },
    {
        "id": "c1-educational-reform-proposal",
        "level": "C1",
        "category": "Workplace & Emails",
        "title": "Policy Proposal for Educational Reform",
        "instructions": "Write an executive policy memo proposing systematic changes to secondary education to better equip students for the 21st-century technological economy. Propose actionable solutions.",
        "targetWords": "250 - 450 words",
        "minWords": 150,
        "keywords": ["pedagogical", "curriculum", "critical thinking", "implementation", "strategic"],
        "order": 14
    }
]

def seed_writing_prompts():
    if not db:
        print("Error: Database not initialized.")
        return

    collection_ref = db.collection("writing_prompts")
    print("Seeding writing prompts to Firestore 'writing_prompts' collection...")
    
    count = 0
    for prompt in INITIAL_WRITING_PROMPTS:
        doc_id = prompt["id"]
        collection_ref.document(doc_id).set(prompt, merge=True)
        count += 1
        print(f" - [{prompt['level']}] Saved: {prompt['title']} ({doc_id})")

    print(f"\nSuccessfully populated {count} writing prompts into Firestore!")

if __name__ == "__main__":
    seed_writing_prompts()
