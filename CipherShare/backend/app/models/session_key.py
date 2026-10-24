"""SessionKey ORM model for CipherShare.

Manages session key lifecycle, expiration, rotation, and invalidation.
"""

from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SessionKey(Base):
    """Represents an AES session key lifecycle record for a file transfer."""

    __tablename__ = "session_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transfer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("file_transfers.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Base64-encoded RSA-OAEP encrypted AES key
    encrypted_session_key: Mapped[str] = mapped_column(Text, nullable=False)

    # Base64-encoded initialization vector / nonce
    nonce_or_iv: Mapped[str] = mapped_column(Text, nullable=False)

    # Base64-encoded authentication tag for AEAD ciphers
    auth_tag: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Status: ACTIVE, ROTATED, EXPIRED, INVALIDATED
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False, index=True)

    algorithm: Mapped[str] = mapped_column(String(50), default="AES-256-GCM", nullable=False)
    key_size_bits: Mapped[int] = mapped_column(Integer, default=256, nullable=False)
    rotation_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    rotated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    invalidated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    invalidation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationship
    transfer = relationship("FileTransfer", back_populates="session_keys")
