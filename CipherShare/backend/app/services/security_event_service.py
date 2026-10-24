"""Security Event Logger and Audit Service.

Records all security-relevant occurrences including key lifecycle transitions,
transfers, integrity verification results, anomaly flags, and attack simulations.
"""

import json
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc

from app.models.security_event import SecurityEvent


class SecurityEventService:
    @staticmethod
    def log_event(
        db: Session,
        event_type: str,
        description: str,
        severity: str = "INFO",
        user_id: Optional[int] = None,
        transfer_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        mitigation_action: Optional[str] = None,
    ) -> SecurityEvent:
        """Create and persist a security event audit record."""
        event = SecurityEvent(
            timestamp=datetime.now(timezone.utc),
            event_type=event_type,
            severity=severity.upper(),
            user_id=user_id,
            transfer_id=transfer_id,
            ip_address=ip_address,
            description=description,
            details=json.dumps(details) if details is not None else None,
            mitigation_action=mitigation_action,
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    @staticmethod
    def get_recent_incidents_count(db: Session, user_id: Optional[int] = None, hours: int = 24) -> int:
        """Count critical security events and integrity failures within the time window."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        query = db.query(SecurityEvent).filter(
            SecurityEvent.timestamp >= cutoff,
            SecurityEvent.severity.in_(["WARNING", "CRITICAL"]),
        )
        if user_id is not None:
            query = query.filter(SecurityEvent.user_id == user_id)
        return query.count()

    @staticmethod
    def get_events(
        db: Session,
        limit: int = 50,
        severity: Optional[str] = None,
        event_type: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> List[SecurityEvent]:
        """Query security events with optional filtering."""
        query = db.query(SecurityEvent)
        if severity:
            query = query.filter(SecurityEvent.severity == severity.upper())
        if event_type:
            query = query.filter(SecurityEvent.event_type == event_type.upper())
        if user_id:
            query = query.filter(SecurityEvent.user_id == user_id)
        return query.order_by(desc(SecurityEvent.timestamp)).limit(limit).all()

    @staticmethod
    def get_audit_summary(db: Session) -> Dict[str, Any]:
        """Calculate system-wide security metrics for the dashboard."""
        total_events = db.query(SecurityEvent).count()
        critical_events = db.query(SecurityEvent).filter(SecurityEvent.severity == "CRITICAL").count()
        warning_events = db.query(SecurityEvent).filter(SecurityEvent.severity == "WARNING").count()
        integrity_failures = db.query(SecurityEvent).filter(SecurityEvent.event_type == "INTEGRITY_FAILURE").count()
        integrity_verified = db.query(SecurityEvent).filter(SecurityEvent.event_type == "INTEGRITY_VERIFIED").count()
        key_rotations = db.query(SecurityEvent).filter(SecurityEvent.event_type == "KEY_ROTATED").count()

        return {
            "total_events": total_events,
            "critical_events": critical_events,
            "warning_events": warning_events,
            "integrity_failures": integrity_failures,
            "integrity_verified": integrity_verified,
            "key_rotations": key_rotations,
        }
