"""FileTransfer ORM model for CipherShare.

Stores metadata for encrypted files transferred between users.
"""

from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class FileTransfer(Base):
    """Represents a secure file transfer between sender and recipient."""

    __tablename__ = "file_transfers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sender_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    receiver_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    encrypted_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), default="application/octet-stream", nullable=False)

    # Sensitivity: LOW, MEDIUM, HIGH, CRITICAL
    sensitivity: Mapped[str] = mapped_column(String(20), default="MEDIUM", nullable=False)

    # Integrity hash of original plaintext file
    original_sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Cipher: AES-256-GCM, AES-128-GCM, CHACHA20-POLY1305
    cipher_algorithm: Mapped[str] = mapped_column(String(50), default="AES-256-GCM", nullable=False)

    # Status: ACTIVE, DECRYPTED, EXPIRED, COMPROMISED, REVOKED
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False, index=True)

    download_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_downloads: Mapped[int] = mapped_column(Integer, default=5, nullable=False)

    # Serialized JSON of adaptive policy decision
    policy_applied: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], backref="sent_transfers")
    receiver = relationship("User", foreign_keys=[receiver_id], backref="received_transfers")
    session_keys = relationship("SessionKey", back_populates="transfer", cascade="all, delete-orphan")
    security_events = relationship("SecurityEvent", back_populates="transfer")
