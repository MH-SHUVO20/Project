import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ApiKey, User


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    JWT_SECRET_KEY = secrets.token_urlsafe(48)
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))

API_KEY_PREFIX = "bsp_"


def validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password is too long for bcrypt")


def hash_password(password: str) -> str:
    validate_password_strength(password)
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


# ── API Key helpers ──────────────────────────────────

def generate_api_key() -> str:
    """Generate a new raw API key like bsp_a1b2c3d4e5f6..."""
    random_part = secrets.token_hex(24)
    return f"{API_KEY_PREFIX}{random_part}"


def hash_api_key(raw_key: str) -> str:
    """SHA-256 hash of the raw API key for storage."""
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def get_api_key_prefix(raw_key: str) -> str:
    """Return the visible prefix portion of the key (first 12 chars)."""
    return raw_key[:12]


def _resolve_user_from_api_key(api_key_str: str, db: Session) -> User | None:
    """Look up a user by raw API key. Returns None if invalid/inactive."""
    key_hashed = hash_api_key(api_key_str)
    api_key_row = (
        db.query(ApiKey)
        .filter(ApiKey.key_hash == key_hashed, ApiKey.is_active == True)
        .first()
    )
    if not api_key_row:
        return None

    # Update last_used_at timestamp
    api_key_row.last_used_at = datetime.now(timezone.utc)
    db.commit()

    return api_key_row.user


# ── Auth dependency (JWT or API Key) ─────────────────

def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    # 1) Try X-API-Key header first
    api_key_header = request.headers.get("X-API-Key")
    if api_key_header:
        user = _resolve_user_from_api_key(api_key_header, db)
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid or revoked API key")
        return user

    # 2) Try Bearer token (JWT)
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = credentials.credentials

    # Check if the bearer token is actually an API key
    if token.startswith(API_KEY_PREFIX):
        user = _resolve_user_from_api_key(token, db)
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid or revoked API key")
        return user

    # Standard JWT decode
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user
