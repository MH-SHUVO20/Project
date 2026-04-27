from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_email_lower", "email"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str | None] = mapped_column(String(160), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    two_factor_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notify_analysis_complete: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_weekly_summary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_product_updates: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notify_marketing_emails: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    theme: Mapped[str] = mapped_column(String(20), nullable=False, default="light")
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="en")
    compact_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    predictions = relationship("Prediction", back_populates="user", cascade="all, delete-orphan")
    batch_jobs = relationship("BatchJob", back_populates="user", cascade="all, delete-orphan")
    feedback_items = relationship("Feedback", back_populates="user", cascade="all, delete-orphan")
    api_keys = relationship("ApiKey", back_populates="user", cascade="all, delete-orphan")


class Prediction(Base):
    __tablename__ = "predictions"
    __table_args__ = (
        CheckConstraint("sentiment in ('positive', 'negative', 'neutral')", name="ck_predictions_sentiment"),
        CheckConstraint("emotion in ('happy', 'love', 'sadness', 'fear', 'anger', 'other')", name="ck_predictions_emotion"),
        CheckConstraint("confidence >= 0 and confidence <= 1", name="ck_predictions_confidence"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    sentiment: Mapped[str] = mapped_column(String(32), nullable=False)
    emotion: Mapped[str] = mapped_column(String(32), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    score_positive: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    score_neutral: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    score_negative: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    score_happy: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    score_love: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    score_sadness: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    score_fear: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    score_anger: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    score_other: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    user = relationship("User", back_populates="predictions")
    feedback_items = relationship("Feedback", back_populates="prediction", cascade="all, delete-orphan")


class BatchJob(Base):
    __tablename__ = "batch_jobs"
    __table_args__ = (
        CheckConstraint("status in ('running', 'completed', 'failed')", name="ck_batch_jobs_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="completed")
    total_items: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="batch_jobs")


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    prediction_id: Mapped[int] = mapped_column(ForeignKey("predictions.id", ondelete="CASCADE"), nullable=False, index=True)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    corrected_sentiment: Mapped[str | None] = mapped_column(String(32), nullable=True)
    corrected_emotion: Mapped[str | None] = mapped_column(String(32), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="feedback_items")
    prediction = relationship("Prediction", back_populates="feedback_items")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    key_prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    label: Mapped[str] = mapped_column(String(60), nullable=False, default="default")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user = relationship("User", back_populates="api_keys")
