import os
from datetime import datetime, timezone
from typing import Optional
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token, get_current_user, hash_password, verify_password,
    generate_api_key, hash_api_key, get_api_key_prefix,
)
from app.database import Base, engine, get_db
from app.inference import model_status, predict_batch, predict_single
from app.models import ApiKey, BatchJob, Feedback, Prediction, User
from app.schema import ensure_schema


VALID_SENTIMENTS = {"positive", "negative", "neutral"}
VALID_EMOTIONS = {"happy", "love", "sadness", "fear", "anger", "other"}
VALID_THEMES = {"light", "dark", "system"}
VALID_LANGUAGES = {"en", "bn"}


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UpdateProfileRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    company: Optional[str] = Field(default=None, max_length=160)
    bio: Optional[str] = Field(default=None, max_length=1000)
    two_factor_enabled: Optional[bool] = None
    notify_analysis_complete: Optional[bool] = None
    notify_weekly_summary: Optional[bool] = None
    notify_product_updates: Optional[bool] = None
    notify_marketing_emails: Optional[bool] = None
    theme: Optional[str] = Field(default=None, max_length=20)
    language: Optional[str] = Field(default=None, max_length=10)
    compact_mode: Optional[bool] = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)


class PredictRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class PredictBatchRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=200)


class FeedbackRequest(BaseModel):
    is_correct: Optional[bool] = None
    corrected_sentiment: Optional[str] = Field(default=None, max_length=32)
    corrected_emotion: Optional[str] = Field(default=None, max_length=32)
    note: Optional[str] = Field(default=None, max_length=1000)


def _normalize_prediction(row: Prediction) -> dict:
    return {
        "id": row.id,
        "text": row.text,
        "sentiment": row.sentiment,
        "emotion": row.emotion,
        "confidence": row.confidence,
        "scores": {
            "positive": row.score_positive,
            "neutral": row.score_neutral,
            "negative": row.score_negative,
        },
        "emotion_scores": {
            "happy": row.score_happy,
            "love": row.score_love,
            "sadness": row.score_sadness,
            "fear": row.score_fear,
            "anger": row.score_anger,
            "other": row.score_other,
        },
        "created_at": row.created_at.isoformat() if row.created_at else datetime.now(timezone.utc).isoformat(),
    }


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _normalize_user(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "company": user.company or "",
        "bio": user.bio or "",
        "two_factor_enabled": bool(user.two_factor_enabled),
        "notify_analysis_complete": bool(user.notify_analysis_complete),
        "notify_weekly_summary": bool(user.notify_weekly_summary),
        "notify_product_updates": bool(user.notify_product_updates),
        "notify_marketing_emails": bool(user.notify_marketing_emails),
        "theme": user.theme or "light",
        "language": user.language or "en",
        "compact_mode": bool(user.compact_mode),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


app = FastAPI(title=os.getenv("APP_NAME", "SentimentPro API"))

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:9090,http://127.0.0.1:9090",
)
origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent

app.mount("/css",    StaticFiles(directory=BASE_DIR / "css"),    name="css")
app.mount("/js",     StaticFiles(directory=BASE_DIR / "js"),     name="js")
app.mount("/html",   StaticFiles(directory=BASE_DIR / "html"),   name="html")

if (BASE_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=BASE_DIR / "assets"), name="assets")

@app.get("/")
async def root():
    """Redirect to login page."""
    return FileResponse(BASE_DIR / "index.html")

@app.get("/{page_name}.html")
async def serve_page_legacy(page_name: str):
    """Legacy route — redirect old top-level .html URLs to /html/."""
    file_path = BASE_DIR / "html" / f"{page_name}.html"
    if file_path.is_file():
        return FileResponse(file_path)
    return JSONResponse({"error": "Page not found"}, status_code=404)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema()


@app.get("/health")
def health(db: Session = Depends(get_db)) -> dict:
    database = {"connected": False}
    try:
        db.execute(sql_text("SELECT 1"))
        database["connected"] = True
    except Exception:
        database["connected"] = False

    return {
        "status": "ok" if database["connected"] else "degraded",
        "service": "sentimentpro-api",
        "database": database,
        "model": model_status(),
    }


@app.post("/auth/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> dict:
    email = _normalize_email(str(payload.email))
    name = payload.name.strip()
    exists = db.query(User).filter(User.email == email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email already exists")

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(payload.password),
        company=None,
        bio=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return _normalize_user(user)


@app.post("/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict:
    email = _normalize_email(str(payload.email))
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(str(user.id))
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _normalize_user(user),
    }


@app.get("/auth/me")
def me(current_user: User = Depends(get_current_user)) -> dict:
    return _normalize_user(current_user)


@app.patch("/auth/me")
def update_profile(
    payload: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    email = _normalize_email(str(payload.email))
    name = payload.name.strip()
    theme = payload.theme.strip().lower() if payload.theme else None
    language = payload.language.strip().lower() if payload.language else None
    if theme and theme not in VALID_THEMES:
        raise HTTPException(status_code=400, detail="Invalid theme")
    if language and language not in VALID_LANGUAGES:
        raise HTTPException(status_code=400, detail="Invalid language")

    exists = (
        db.query(User)
        .filter(User.email == email, User.id != current_user.id)
        .first()
    )
    if exists:
        raise HTTPException(status_code=400, detail="Email already exists")

    current_user.name = name
    current_user.email = email
    current_user.company = _clean_optional_text(payload.company)
    current_user.bio = _clean_optional_text(payload.bio)
    if payload.two_factor_enabled is not None:
        current_user.two_factor_enabled = payload.two_factor_enabled
    if payload.notify_analysis_complete is not None:
        current_user.notify_analysis_complete = payload.notify_analysis_complete
    if payload.notify_weekly_summary is not None:
        current_user.notify_weekly_summary = payload.notify_weekly_summary
    if payload.notify_product_updates is not None:
        current_user.notify_product_updates = payload.notify_product_updates
    if payload.notify_marketing_emails is not None:
        current_user.notify_marketing_emails = payload.notify_marketing_emails
    if theme:
        current_user.theme = theme
    if language:
        current_user.language = language
    if payload.compact_mode is not None:
        current_user.compact_mode = payload.compact_mode
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)
    return _normalize_user(current_user)


@app.post("/auth/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"ok": True}


@app.get("/auth/export")
def export_account_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    predictions = (
        db.query(Prediction)
        .filter(Prediction.user_id == current_user.id)
        .order_by(Prediction.created_at.desc())
        .all()
    )
    feedback_items = db.query(Feedback).filter(Feedback.user_id == current_user.id).all()
    return {
        "user": _normalize_user(current_user),
        "predictions": [_normalize_prediction(row) for row in predictions],
        "feedback": [
            {
                "id": row.id,
                "prediction_id": row.prediction_id,
                "is_correct": row.is_correct,
                "corrected_sentiment": row.corrected_sentiment,
                "corrected_emotion": row.corrected_emotion,
                "note": row.note,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in feedback_items
        ],
    }


@app.delete("/auth/me")
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    prediction_ids = [
        row.id
        for row in db.query(Prediction.id)
        .filter(Prediction.user_id == current_user.id)
        .all()
    ]
    db.query(Feedback).filter(Feedback.user_id == current_user.id).delete(synchronize_session=False)
    if prediction_ids:
        db.query(Prediction).filter(Prediction.id.in_(prediction_ids)).delete(synchronize_session=False)
    db.query(BatchJob).filter(BatchJob.user_id == current_user.id).delete(synchronize_session=False)
    db.query(ApiKey).filter(ApiKey.user_id == current_user.id).delete(synchronize_session=False)
    db.delete(current_user)
    db.commit()
    return {"ok": True}


@app.post("/predict")
def predict(
    payload: PredictRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    result = predict_single(text)

    row = Prediction(
        user_id=current_user.id,
        text=text,
        sentiment=result.get("sentiment", "neutral"),
        emotion=result.get("emotion", "other"),
        confidence=float(result.get("confidence", 0.0)),
        score_positive=float(result.get("scores", {}).get("positive", 0.0)),
        score_neutral=float(result.get("scores", {}).get("neutral", 0.0)),
        score_negative=float(result.get("scores", {}).get("negative", 0.0)),
        score_happy=float(result.get("emotion_scores", {}).get("happy", 0.0)),
        score_love=float(result.get("emotion_scores", {}).get("love", 0.0)),
        score_sadness=float(result.get("emotion_scores", {}).get("sadness", 0.0)),
        score_fear=float(result.get("emotion_scores", {}).get("fear", 0.0)),
        score_anger=float(result.get("emotion_scores", {}).get("anger", 0.0)),
        score_other=float(result.get("emotion_scores", {}).get("other", 0.0)),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return _normalize_prediction(row)


@app.post("/predict/batch")
def predict_batch_endpoint(
    payload: PredictBatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    texts = [text.strip() for text in payload.texts if text and text.strip()]
    if not texts:
        raise HTTPException(status_code=400, detail="texts must contain at least one non-empty value")

    batch = BatchJob(user_id=current_user.id, status="running", total_items=len(texts))
    db.add(batch)
    db.flush()

    try:
        results = predict_batch(texts)
    except Exception:
        batch.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail="Batch prediction failed")

    created_rows = []
    for text, result in zip(texts, results):
        row = Prediction(
            user_id=current_user.id,
            text=text,
            sentiment=result.get("sentiment", "neutral"),
            emotion=result.get("emotion", "other"),
            confidence=float(result.get("confidence", 0.0)),
            score_positive=float(result.get("scores", {}).get("positive", 0.0)),
            score_neutral=float(result.get("scores", {}).get("neutral", 0.0)),
            score_negative=float(result.get("scores", {}).get("negative", 0.0)),
            score_happy=float(result.get("emotion_scores", {}).get("happy", 0.0)),
            score_love=float(result.get("emotion_scores", {}).get("love", 0.0)),
            score_sadness=float(result.get("emotion_scores", {}).get("sadness", 0.0)),
            score_fear=float(result.get("emotion_scores", {}).get("fear", 0.0)),
            score_anger=float(result.get("emotion_scores", {}).get("anger", 0.0)),
            score_other=float(result.get("emotion_scores", {}).get("other", 0.0)),
        )
        db.add(row)
        created_rows.append(row)

    batch.status = "completed"
    db.commit()

    for row in created_rows:
        db.refresh(row)

    return {
        "batch_job_id": batch.id,
        "count": len(created_rows),
        "results": [_normalize_prediction(row) for row in created_rows],
    }


@app.get("/history")
def history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    rows = (
        db.query(Prediction)
        .filter(Prediction.user_id == current_user.id)
        .order_by(Prediction.created_at.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )
    return {"items": [_normalize_prediction(row) for row in rows]}


@app.delete("/history/{prediction_id}")
def delete_history_item(
    prediction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    row = (
        db.query(Prediction)
        .filter(Prediction.id == prediction_id, Prediction.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Prediction not found")

    db.query(Feedback).filter(
        Feedback.prediction_id == prediction_id,
        Feedback.user_id == current_user.id,
    ).delete(synchronize_session=False)
    db.delete(row)
    db.commit()
    return {"ok": True, "deleted": 1}


@app.delete("/history")
def clear_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    prediction_ids = [
        row.id
        for row in db.query(Prediction.id)
        .filter(Prediction.user_id == current_user.id)
        .all()
    ]
    if not prediction_ids:
        return {"ok": True, "deleted": 0}

    db.query(Feedback).filter(
        Feedback.user_id == current_user.id,
        Feedback.prediction_id.in_(prediction_ids),
    ).delete(synchronize_session=False)
    deleted = db.query(Prediction).filter(
        Prediction.user_id == current_user.id,
        Prediction.id.in_(prediction_ids),
    ).delete(synchronize_session=False)
    db.commit()
    return {"ok": True, "deleted": deleted}


@app.get("/stats")
def stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    rows = db.query(Prediction).filter(Prediction.user_id == current_user.id).all()
    total = len(rows)

    if total == 0:
        return {
            "total_analyses": 0,
            "total_reviews": 0,
            "positive_percentage": 0,
            "negative_percentage": 0,
        }

    pos = sum(1 for row in rows if (row.sentiment or "").lower() == "positive")
    neg = sum(1 for row in rows if (row.sentiment or "").lower() == "negative")

    return {
        "total_analyses": total,
        "total_reviews": total,
        "positive_percentage": round((pos / total) * 100, 2),
        "negative_percentage": round((neg / total) * 100, 2),
    }


@app.post("/feedback/{prediction_id}")
def feedback(
    prediction_id: int,
    payload: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    row = (
        db.query(Prediction)
        .filter(Prediction.id == prediction_id, Prediction.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Prediction not found")

    corrected_sentiment = payload.corrected_sentiment.strip().lower() if payload.corrected_sentiment else None
    corrected_emotion = payload.corrected_emotion.strip().lower() if payload.corrected_emotion else None
    if corrected_sentiment and corrected_sentiment not in VALID_SENTIMENTS:
        raise HTTPException(status_code=400, detail="Invalid corrected sentiment")
    if corrected_emotion and corrected_emotion not in VALID_EMOTIONS:
        raise HTTPException(status_code=400, detail="Invalid corrected emotion")

    feedback_row = Feedback(
        user_id=current_user.id,
        prediction_id=prediction_id,
        is_correct=payload.is_correct,
        corrected_sentiment=corrected_sentiment,
        corrected_emotion=corrected_emotion,
        note=payload.note.strip() if payload.note else None,
    )
    db.add(feedback_row)
    db.commit()
    db.refresh(feedback_row)

    return {"id": feedback_row.id, "prediction_id": feedback_row.prediction_id}


# ── API Key Management ───────────────────────────────

class CreateApiKeyRequest(BaseModel):
    label: str = Field(default="default", min_length=1, max_length=60)


@app.post("/api-keys")
def create_api_key(
    payload: CreateApiKeyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Generate a new API key. The raw key is shown only once."""
    # Limit to 5 active keys per user
    active_count = db.query(ApiKey).filter(
        ApiKey.user_id == current_user.id, ApiKey.is_active == True
    ).count()
    if active_count >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 active API keys allowed")

    raw_key = generate_api_key()
    key_row = ApiKey(
        user_id=current_user.id,
        key_prefix=get_api_key_prefix(raw_key),
        key_hash=hash_api_key(raw_key),
        label=payload.label.strip(),
    )
    db.add(key_row)
    db.commit()
    db.refresh(key_row)

    return {
        "id": key_row.id,
        "key": raw_key,
        "prefix": key_row.key_prefix,
        "label": key_row.label,
        "created_at": key_row.created_at.isoformat() if key_row.created_at else None,
        "message": "Save this key now. It will not be shown again.",
    }


@app.get("/api-keys")
def list_api_keys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """List all API keys for the current user (prefix only, never the full key)."""
    rows = (
        db.query(ApiKey)
        .filter(ApiKey.user_id == current_user.id)
        .order_by(ApiKey.created_at.desc())
        .all()
    )
    return {
        "keys": [
            {
                "id": row.id,
                "prefix": row.key_prefix,
                "label": row.label,
                "is_active": row.is_active,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "last_used_at": row.last_used_at.isoformat() if row.last_used_at else None,
            }
            for row in rows
        ]
    }


@app.delete("/api-keys/{key_id}")
def revoke_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Revoke (deactivate) an API key."""
    row = (
        db.query(ApiKey)
        .filter(ApiKey.id == key_id, ApiKey.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="API key not found")

    row.is_active = False
    db.commit()
    return {"ok": True, "id": key_id, "status": "revoked"}
