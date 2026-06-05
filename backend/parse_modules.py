import os
import glob
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

scratch_dir = r"C:\Users\user\.gemini\antigravity-ide\brain\5d645017-d982-454a-a60b-b999b12502d9\scratch"
txt_files = glob.glob(os.path.join(scratch_dir, "A1 Module *.txt"))
txt_files.sort()

model = genai.GenerativeModel('models/gemini-3.1-flash-lite')

all_lessons = []
global_order = 1

for txt_path in txt_files:
    basename = os.path.basename(txt_path)
    print(f"Parsing {basename}...")
    
    with open(txt_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    prompt = f"""
You are an expert curriculum developer. Below is the raw text script for an English language learning module.
I need you to extract EVERY individual speaking task/lesson from this module and format it as a JSON array.

Module Text:
{content[:150000]}

Follow this JSON schema for each task you extract:
{{
  "lessonId": "a1_m[module_number]_[task_number]_[short_name]",
  "cefrLevel": "A1",
  "moduleId": "a1_m[module_number]",
  "moduleTitle": "[Title of the Module]",
  "moduleOrder": [module_number],
  "taskOrder": [task_number],
  "title": "[Title of the Task/Lesson]",
  "objective": "[What the student must achieve in the speaking task. E.g. 'Introduce yourself...']",
  "aiRole": "[The persona the AI must adopt. E.g. 'Miss Aster, an English teacher']",
  "context": "[The situation the roleplay is set in]",
  "targetVocabulary": ["word1", "word2"]
}}

IMPORTANT RULES:
- Output ONLY valid JSON containing an array of these objects.
- Ensure 'lessonId' is unique.
- Do NOT include markdown code blocks like ```json in the output, just the raw JSON text.
"""
    try:
        response = model.generate_content(prompt)
        text_resp = response.text.strip()
        if text_resp.startswith('```json'):
            text_resp = text_resp[7:]
        if text_resp.endswith('```'):
            text_resp = text_resp[:-3]
            
        parsed_json = json.loads(text_resp.strip())
        
        for lesson in parsed_json:
            lesson["order"] = global_order
            global_order += 1
            all_lessons.append(lesson)
            print(f"  -> Extracted: {lesson['title']}")
            
    except Exception as e:
        print(f"Error parsing {basename}: {e}")

output_json = r"c:\Users\user\Desktop\projects\Speech Improvement AI\backend\a1_parsed_curriculum.json"
with open(output_json, 'w', encoding='utf-8') as f:
    json.dump(all_lessons, f, indent=2)

print(f"\nSuccessfully parsed {len(all_lessons)} lessons from {len(txt_files)} modules.")
print(f"Saved to {output_json}")
