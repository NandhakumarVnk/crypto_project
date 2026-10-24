"""API endpoints for file transfers, policy evaluation, and decryption verification."""

import json
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, status
from fastapi.responses import Response, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.file_transfer import FileTransfer
from app.models.session_key import SessionKey
from app.services.file_transfer_service import FileTransferService
from app.services.key_management_service import KeyManagementService
from app.services.security_event_service import SecurityEventService
from app.crypto.adaptive_policy import AdaptiveSecurityPolicyEngine
from app.schemas.transfer import (
    PolicyPreviewRequest,
    PolicyPreviewResponse,
    FileTransferResponse,
    VerificationReportResponse,
)
from app.schemas.security import UserPublicInfo

router = APIRouter(prefix="/api/transfers", tags=["transfers"])


def _to_transfer_response(t: FileTransfer, db: Session) -> FileTransferResponse:
    latest_key = (
        db.query(SessionKey)
        .filter(SessionKey.transfer_id == t.id)
        .order_by(desc(SessionKey.created_at))
        .first()
    )
    # Check expiry dynamically
    if latest_key and latest_key.status == "ACTIVE":
        KeyManagementService.check_and_update_expiry(db, latest_key)

    return FileTransferResponse(
        id=t.id,
        sender_id=t.sender_id,
        sender_email=t.sender.email if t.sender else "Unknown",
        receiver_id=t.receiver_id,
        receiver_email=t.receiver.email if t.receiver else "Unknown",
        original_filename=t.original_filename,
        file_size_bytes=t.file_size_bytes,
        encrypted_size_bytes=t.encrypted_size_bytes,
        mime_type=t.mime_type,
        sensitivity=t.sensitivity,
        original_sha256=t.original_sha256,
        cipher_algorithm=t.cipher_algorithm,
        status=t.status,
        download_count=t.download_count,
        max_downloads=t.max_downloads,
        key_status=latest_key.status if latest_key else None,
        key_expires_at=latest_key.expires_at if latest_key else None,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.post("/preview-policy", response_model=PolicyPreviewResponse)
def preview_policy(
    payload: PolicyPreviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Preview the Adaptive Security Policy decision before initiating a transfer."""
    recent_incidents = SecurityEventService.get_recent_incidents_count(db, user_id=current_user.id)
    decision = AdaptiveSecurityPolicyEngine.evaluate(
        file_size_bytes=payload.file_size_bytes,
        filename=payload.filename,
        sensitivity=payload.sensitivity,
        recent_security_incidents=recent_incidents,
        preferred_cipher=payload.preferred_cipher,
    )
    return PolicyPreviewResponse(**decision.to_dict())


@router.post("/send", response_model=FileTransferResponse, status_code=status.HTTP_201_CREATED)
async def send_file(
    request: Request,
    file: UploadFile = File(...),
    receiver_id: int = Form(...),
    sensitivity: str = Form("MEDIUM"),
    preferred_cipher: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Encrypt and transfer a file using Adaptive Cryptographic Key Management."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Cannot upload an empty file.")

    client_ip = request.client.host if request.client else None
    transfer = FileTransferService.create_transfer(
        db=db,
        sender=current_user,
        receiver_id=receiver_id,
        filename=file.filename or "unnamed_file.bin",
        content=content,
        sensitivity=sensitivity,
        preferred_cipher=preferred_cipher,
        ip_address=client_ip,
    )
    return _to_transfer_response(transfer, db)


@router.get("/inbox", response_model=List[FileTransferResponse])
def get_inbox_transfers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List incoming encrypted files waiting for decryption by the current user."""
    transfers = (
        db.query(FileTransfer)
        .filter(FileTransfer.receiver_id == current_user.id)
        .order_by(desc(FileTransfer.created_at))
        .all()
    )
    return [_to_transfer_response(t, db) for t in transfers]


@router.get("/sent", response_model=List[FileTransferResponse])
def get_sent_transfers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List encrypted files sent by the current user."""
    transfers = (
        db.query(FileTransfer)
        .filter(FileTransfer.sender_id == current_user.id)
        .order_by(desc(FileTransfer.created_at))
        .all()
    )
    return [_to_transfer_response(t, db) for t in transfers]


@router.get("/recipients", response_model=List[UserPublicInfo])
def get_recipients(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List registered recipient users eligible for secure file transfer."""
    users = db.query(User).filter(User.id != current_user.id, User.is_active == True).all()
    res = []
    for u in users:
        # Ensure recipient keypair exists
        KeyManagementService.ensure_user_keypair(db, u)
        res.append(
            UserPublicInfo(
                id=u.id,
                email=u.email,
                has_rsa_key=bool(u.rsa_public_key),
                public_key_pem=u.rsa_public_key,
            )
        )
    return res


@router.get("/{transfer_id}", response_model=FileTransferResponse)
def get_transfer_details(
    transfer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve details and status for a specific file transfer."""
    transfer = (
        db.query(FileTransfer)
        .filter(
            FileTransfer.id == transfer_id,
            or_(FileTransfer.sender_id == current_user.id, FileTransfer.receiver_id == current_user.id),
        )
        .first()
    )
    if not transfer:
        raise HTTPException(status_code=404, detail="File transfer not found or unauthorized.")
    return _to_transfer_response(transfer, db)


@router.get("/{transfer_id}/download")
def download_decrypted_file(
    transfer_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Decrypt file using receiver RSA private key, verify SHA-256 integrity, and download."""
    client_ip = request.client.host if request.client else None
    plaintext, filename, mime_type, report = FileTransferService.decrypt_and_verify(
        db=db,
        transfer_id=transfer_id,
        user=current_user,
        ip_address=client_ip,
        simulate_tampering=False,
    )

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "X-CipherShare-SHA256": report["computed_sha256"],
        "X-CipherShare-Integrity": "VERIFIED",
    }
    return Response(content=plaintext, media_type=mime_type, headers=headers)


@router.post("/{transfer_id}/verify", response_model=VerificationReportResponse)
def verify_transfer_integrity(
    transfer_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Perform integrity verification on the file without downloading payload."""
    client_ip = request.client.host if request.client else None
    _, filename, _, report = FileTransferService.decrypt_and_verify(
        db=db,
        transfer_id=transfer_id,
        user=current_user,
        ip_address=client_ip,
        simulate_tampering=False,
    )
    return VerificationReportResponse(**report)
