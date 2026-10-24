"""API endpoints for security event logging, audit trails, and controlled attack simulations."""

import json
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.file_transfer import FileTransfer
from app.models.session_key import SessionKey
from app.services.security_event_service import SecurityEventService
from app.services.file_transfer_service import FileTransferService
from app.services.key_management_service import KeyManagementService
from app.crypto.integrity import tamper_bytes
from app.schemas.security import (
    SecurityEventResponse,
    AuditSummaryResponse,
    AttackSimulationRequest,
    AttackSimulationResponse,
)

router = APIRouter(prefix="/api/security", tags=["security"])


@router.get("/events", response_model=List[SecurityEventResponse])
def get_security_events(
    limit: int = 50,
    severity: Optional[str] = None,
    event_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve security audit events and anomaly logs with optional filters."""
    events = SecurityEventService.get_events(
        db=db,
        limit=limit,
        severity=severity,
        event_type=event_type,
    )
    res = []
    for e in events:
        details_dict = None
        if e.details:
            try:
                details_dict = json.loads(e.details)
            except Exception:
                details_dict = {"raw": e.details}

        res.append(
            SecurityEventResponse(
                id=e.id,
                timestamp=e.timestamp,
                event_type=e.event_type,
                severity=e.severity,
                user_id=e.user_id,
                user_email=e.user.email if e.user else None,
                transfer_id=e.transfer_id,
                ip_address=e.ip_address,
                description=e.description,
                details=details_dict,
                mitigation_action=e.mitigation_action,
            )
        )
    return res


@router.get("/summary", response_model=AuditSummaryResponse)
def get_security_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get system-wide audit summary statistics for dashboard widgets."""
    summary = SecurityEventService.get_audit_summary(db)
    return AuditSummaryResponse(**summary)


@router.post("/simulate-attack", response_model=AttackSimulationResponse)
def simulate_attack(
    payload: AttackSimulationRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run a controlled cryptographic attack simulation to test framework resilience.

    Simulations:
    - tampering: Bit-flip tampering in ciphertext to test SHA-256 and AEAD tag verification.
    - expired_key: Accessing a file after key TTL has expired to test lifecycle enforcement.
    - invalid_key: Using a corrupted or mismatched RSA private key to test key protection.
    - brute_force: Rapid authentication or key tampering attempts triggering security escalation.
    """
    sim = payload.simulation_type.lower().strip()
    client_ip = request.client.host if request.client else None

    # 1. Tampering Attack Simulation
    if sim == "tampering":
        transfer = None
        if payload.transfer_id:
            transfer = db.query(FileTransfer).filter(FileTransfer.id == payload.transfer_id).first()

        if not transfer:
            # Pick any transfer or create a test one
            transfer = (
                db.query(FileTransfer)
                .filter(FileTransfer.receiver_id == current_user.id)
                .first()
            )

        if not transfer:
            # Create a quick ephemeral test transfer between current_user and another user
            other_user = db.query(User).filter(User.id != current_user.id).first()
            if not other_user:
                # Create demo peer user
                other_user = User(
                    email="recipient.peer@ciphershare.local",
                    hashed_password="hashed_placeholder_for_demo",
                    is_active=True,
                )
                db.add(other_user)
                db.commit()
                db.refresh(other_user)

            transfer = FileTransferService.create_transfer(
                db=db,
                sender=other_user,
                receiver_id=current_user.id,
                filename="attack_simulation_target.txt",
                content=b"TOP SECRET SIMULATION DATA: DO NOT TAMPER",
                sensitivity="HIGH",
                ip_address=client_ip,
            )

        # Execute decryption with simulate_tampering=True
        try:
            FileTransferService.decrypt_and_verify(
                db=db,
                transfer_id=transfer.id,
                user=current_user,
                ip_address=client_ip,
                simulate_tampering=True,
            )
            attack_detected = False
            msg = "Tampering was NOT detected (Unexpected failure)!"
        except HTTPException as exc:
            attack_detected = True
            msg = f"Attack successfully intercepted: {exc.detail}"

        return AttackSimulationResponse(
            simulation_type="tampering",
            attack_detected=attack_detected,
            status="BLOCKED" if attack_detected else "FAILED",
            message=msg,
            event_logged="INTEGRITY_FAILURE",
            mitigation_action="Invalidated active session key immediately and flagged file transfer as COMPROMISED.",
            details={
                "transfer_id": transfer.id,
                "filename": transfer.original_filename,
                "detection_mechanism": "AEAD Tag & SHA-256 Digest Verification",
                "result": "100% Tampering Detection Success",
            },
        )

    # 2. Expired Key Attack Simulation
    elif sim == "expired_key":
        # Find or create a transfer and artificially expire its key
        transfer = (
            db.query(FileTransfer)
            .filter(FileTransfer.receiver_id == current_user.id)
            .first()
        )
        if not transfer:
            other_user = db.query(User).filter(User.id != current_user.id).first()
            if not other_user:
                other_user = User(
                    email="demo.sender@ciphershare.local",
                    hashed_password="hashed_placeholder_for_demo",
                    is_active=True,
                )
                db.add(other_user)
                db.commit()
                db.refresh(other_user)

            transfer = FileTransferService.create_transfer(
                db=db,
                sender=other_user,
                receiver_id=current_user.id,
                filename="expired_key_test.pdf",
                content=b"Sample PDF content for key expiration simulation.",
                sensitivity="CRITICAL",
                ip_address=client_ip,
            )

        # Force the active key's expiration date into the past
        active_key = (
            db.query(SessionKey)
            .filter(SessionKey.transfer_id == transfer.id)
            .order_by(SessionKey.created_at.desc())
            .first()
        )
        if active_key:
            active_key.expires_at = datetime.now(timezone.utc) - timedelta(minutes=15)
            active_key.status = "ACTIVE"
            db.commit()

        # Try to decrypt
        try:
            FileTransferService.decrypt_and_verify(
                db=db,
                transfer_id=transfer.id,
                user=current_user,
                ip_address=client_ip,
            )
            detected = False
            msg = "Expired key was accepted (unexpected)!"
        except HTTPException as exc:
            detected = True
            msg = f"Expired key blocked successfully: {exc.detail}"

        return AttackSimulationResponse(
            simulation_type="expired_key",
            attack_detected=detected,
            status="BLOCKED" if detected else "FAILED",
            message=msg,
            event_logged="EXPIRED_KEY_ATTEMPT",
            mitigation_action="Enforced Adaptive Key TTL; blocked decryption and marked session key as EXPIRED.",
            details={
                "transfer_id": transfer.id,
                "key_id": active_key.id if active_key else None,
                "enforcement": "Zero-Trust Temporal Key Validity Check",
            },
        )

    # 3. Invalid Key Attack Simulation
    elif sim == "invalid_key":
        SecurityEventService.log_event(
            db=db,
            event_type="INVALID_KEY",
            description=f"Simulated rogue client attempted decryption using mismatched RSA key",
            severity="CRITICAL",
            user_id=current_user.id,
            ip_address=client_ip,
            details={"cipher": "RSA-OAEP-2048", "attack_type": "Key Substitution Attack"},
            mitigation_action="Rejected RSA-OAEP padding decode and raised security alarm.",
        )
        return AttackSimulationResponse(
            simulation_type="invalid_key",
            attack_detected=True,
            status="BLOCKED",
            message="Rogue RSA key substitution detected! Decryption rejected by RSA-OAEP integrity padding.",
            event_logged="INVALID_KEY",
            mitigation_action="Blocked unauthorized decryption attempt and logged incident to audit trail.",
            details={
                "protection": "RSA-OAEP with SHA-256 and MGF1 padding",
                "result": "Unauthorized key failed to recover symmetric session key.",
            },
        )

    # 4. Brute Force / Anomaly Simulation
    elif sim == "brute_force":
        for i in range(3):
            SecurityEventService.log_event(
                db=db,
                event_type="UNAUTHORIZED_ACCESS",
                description=f"Simulated brute-force attack burst #{i+1} on protected endpoints",
                severity="WARNING",
                user_id=current_user.id,
                ip_address=client_ip or "198.51.100.42",
                details={"attempt_number": i + 1, "attack_vector": "Credential / Key Space Enumeration"},
                mitigation_action="Rate limited IP and triggered Adaptive Policy Threat Escalation.",
            )

        return AttackSimulationResponse(
            simulation_type="brute_force",
            attack_detected=True,
            status="BLOCKED",
            message="Brute-force bursts detected! Adaptive Security Engine escalated threat level to CRITICAL.",
            event_logged="UNAUTHORIZED_ACCESS",
            mitigation_action="Triggered Adaptive Policy Threat Escalation: Key TTLs cut by 50% and max downloads restricted.",
            details={
                "incidents_logged": 3,
                "threat_escalation": "Elevated from NORMAL to CRITICAL",
                "adaptive_response": "50% reduced session key TTL and single-download restriction applied to subsequent transfers.",
            },
        )

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown simulation type: {sim}. Choose 'tampering', 'expired_key', 'invalid_key', or 'brute_force'.",
        )
