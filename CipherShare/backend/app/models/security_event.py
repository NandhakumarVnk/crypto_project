"""SecurityEvent ORM model for CipherShare.

Records transfer activities, security events, anomaly detections, and audit logs.
"""

from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SecurityEvent(Base):
    """Represents an audit trail or security event in the system."""

    __tablename__ = "security_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # Event types:
    # INTEGRITY_VERIFIED, INTEGRITY_FAILURE, KEY_GENERATED, KEY_ROTATED,
    # KEY_EXPIRED, KEY_INVALIDATED, FILE_ENCRYPTED, FILE_TRANSFERRED,
    # FILE_DECRYPTED, ATTACK_SIMULATION, UNAUTHORIZED_ACCESS, INVALID_KEY
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Severity: INFO, WARNING, CRITICAL
    severity: Mapped[str] = mapped_column(String(20), default="INFO", nullable=False, index=True)

    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    transfer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("file_transfers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    description: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    mitigation_action: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user = relationship("User", backref="security_events")
    transfer = relationship("FileTransfer", back_populates="security_events")
