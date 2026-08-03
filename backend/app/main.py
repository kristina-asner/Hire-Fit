from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import uuid
import logging
import uvicorn
import io
import pypdf
import docx

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from app.database import init_db, SessionLocal, AnalysisResult, User
from app.tasks import process_resume_analysis
from app.auth import hash_password, verify_password_hash, create_token, require_auth, auth_required

load_dotenv()

# Logger configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("API")

app = FastAPI(title="HireFit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # For local development
        # "https://my-frontend-url.com",  # For production (vercel)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


class SignupRequest(BaseModel):
    name: str
    password: str


class LoginRequest(BaseModel):
    name: str
    password: str


@app.post("/auth/signup")
async def signup(payload: SignupRequest):
    name = payload.name.strip()
    if not name or not payload.password:
        raise HTTPException(status_code=400, detail="Name and password are required")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.name.ilike(name)).first()
        if existing:
            raise HTTPException(status_code=409, detail="That name is already taken")

        password_hash, salt = hash_password(payload.password)
        db.add(User(name=name, password_hash=password_hash, salt=salt))
        db.commit()
    finally:
        db.close()

    logger.info(f"🆕 New HR account created: {name}")
    return {"token": create_token(name), "name": name}


@app.post("/auth/login")
async def login(payload: LoginRequest):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.name.ilike(payload.name.strip())).first()
    finally:
        db.close()

    if not user or not verify_password_hash(payload.password, user.salt, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid name or password")

    return {"token": create_token(user.name), "name": user.name}


# --- Extraction functions inside the API ---
async def extract_text_from_upload(file: UploadFile) -> str:
    # Read the file into memory (Bytes)
    content = await file.read()
    file_obj = io.BytesIO(content)
    text = ""

    try:
        filename = file.filename.lower()
        if filename.endswith('.pdf'):
            reader = pypdf.PdfReader(file_obj)
            for page in reader.pages:
                text += page.extract_text() + "\n"

        elif filename.endswith('.docx'):
            doc = docx.Document(file_obj)
            for para in doc.paragraphs:
                text += para.text + "\n"

        elif filename.endswith('.txt'):
            text = content.decode('utf-8')

    except Exception as e:
        logger.error(f"Error extracting text: {e}")
        return ""

    return text


# ---------------------------------

@app.post("/analyze")
async def start_analysis(
    job_description: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(require_auth),
):
    session_id = str(uuid.uuid4())
    logger.info(f"🔵 NEW REQUEST: {session_id} (by {current_user['name']})")

    # 1. Extract the text in memory (without saving a file)
    resume_text = await extract_text_from_upload(file)

    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file")

    # 2. Save to DB
    db = SessionLocal()
    try:
        new_analysis = AnalysisResult(
            session_id=session_id,
            status="pending",
            job_description=job_description,
            created_by=current_user["name"],
            filename=file.filename,
        )
        db.add(new_analysis)
        db.commit()
    except Exception as e:
        logger.error(f"DB Error: {e}")
        return {"error": "Database error"}
    finally:
        db.close()

    # 3. Send the text (not the file) to Worker
    try:
        # Sending the text as an argument
        process_resume_analysis.delay(session_id, resume_text, job_description)
        logger.info(f"🟢 Task sent to Celery")
    except Exception as e:
        logger.error(f"Celery Error: {e}")
        return {"error": "Failed to queue task"}

    return {"session_id": session_id, "status": "processing"}


@app.get("/status/{session_id}", dependencies=[auth_required])
async def get_status(session_id: str):
    db = SessionLocal()
    try:
        result = db.query(AnalysisResult).filter(AnalysisResult.session_id == session_id).first()
        if not result:
            return {"error": "Not found"}

        return {
            "status": result.status,
            "result": result.result_metadata,
            "formatted_text": result.result_text,
            "created_by": result.created_by,
            "job_description": result.job_description,
        }
    finally:
        db.close()


@app.get("/analyses", dependencies=[auth_required])
async def list_analyses():
    """Full shared history, newest first - lets the dashboard reload after a refresh."""
    db = SessionLocal()
    try:
        results = db.query(AnalysisResult).order_by(AnalysisResult.created_at.desc()).limit(200).all()
        return [
            {
                "session_id": r.session_id,
                "status": r.status,
                "filename": r.filename,
                "created_by": r.created_by,
                "job_description": r.job_description,
                "result": r.result_metadata,
                "formatted_text": r.result_text,
            }
            for r in results
        ]
    finally:
        db.close()


@app.delete("/analyses/{session_id}", dependencies=[auth_required])
async def delete_analysis(session_id: str):
    db = SessionLocal()
    try:
        result = db.query(AnalysisResult).filter(AnalysisResult.session_id == session_id).first()
        if not result:
            raise HTTPException(status_code=404, detail="Not found")
        db.delete(result)
        db.commit()
    finally:
        db.close()
    return {"success": True}


@app.delete("/analyses", dependencies=[auth_required])
async def delete_all_analyses():
    """Clears the entire shared history for every HR - used by the dashboard's Clear All."""
    db = SessionLocal()
    try:
        deleted = db.query(AnalysisResult).delete()
        db.commit()
    finally:
        db.close()
    return {"success": True, "deleted": deleted}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)