from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import allowed_origins
from routers import auth, speech, sessions, students, curriculum, writing

app = FastAPI(title="Speech Improvement AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(speech.router)
app.include_router(sessions.router)
app.include_router(students.router)
app.include_router(curriculum.router)
app.include_router(writing.router)

@app.get("/")
async def root():
    return {"message": "Speech Improvement AI API Service is online."}
