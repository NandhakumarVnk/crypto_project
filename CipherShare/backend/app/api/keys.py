"""API endpoints for session key lifecycle management and user RSA keys."""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.file_transfer import FileTransfer
from app.models.session_key import SessionKey
from app.services.key_management_service import KeyManagementService
from app.schemas.transfer import (
    KeyDetailsResponse,
    RotateKeyRequest,
    InvalidateKeyRequest,
)

router = APIRouter(prefix="/api/keys", tags=["keys"])


@router.get("", response_model=List[KeyDetailsResponse])
def get_session_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all session keys accessible to the current user (as sender or receiver)."""
    # Join with FileTransfer
    keys = (
        db.query(SessionKey)
        .join(FileTransfer)
        .filter(
            or_(
                FileTransfer.sender_id == current_user.id,
                FileTransfer.receiver_id == current_user.id,
            )
        )
        .order_by(desc(SessionKey.created_at))
        .all()
    )

    # Check and update expiry
    for k in keys:
        if k.status == "ACTIVE":
            KeyManagementService.check_and_update_expiry(db, k)

    return [
        KeyDetailsResponse(
            id=k.id,
            transfer_id=k.transfer_id,
            original_filename=k.transfer.original_filename if k.transfer else "Unknown",
            status=k.status,
            algorithm=k.algorithm,
            key_size_bits=k.key_size_bits,
            rotation_count=k.rotation_count,
            created_at=k.created_at,
            expires_at=k.expires_at,
            rotated_at=k.rotated_at,
            invalidated_at=k.invalidated_at,
            invalidation_reason=k.invalidation_reason,
        )
        for k in keys
    ]


@router.post("/rotate", response_model=KeyDetailsResponse)
def rotate_key(
    payload: RotateKeyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually rotate the cryptographic session key for a file transfer."""
    transfer = (
        db.query(FileTransfer)
        .filter(
            FileTransfer.id == payload.transfer_id,
            or_(
                FileTransfer.sender_id == current_user.id,
                FileTransfer.receiver_id == current_user.id,
            ),
        )
        .first()
    )
    if not transfer:
        raise HTTPException(status_code=404, detail="File transfer not found or unauthorized.")

    try:
        new_key = KeyManagementService.rotate_session_key(
            db=db,
            transfer=transfer,
            operator=current_user,
            storage_dir=settings.upload_dir,
            ttl_seconds=payload.ttl_seconds,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Key rotation failed: {str(exc)}")

    return KeyDetailsResponse(
        id=new_key.id,
        transfer_id=new_key.transfer_id,
        original_filename=transfer.original_filename,
        status=new_key.status,
        algorithm=new_key.algorithm,
        key_size_bits=new_key.key_size_bits,
        rotation_count=new_key.rotation_count,
        created_at=new_key.created_at,
        expires_at=new_key.expires_at,
        rotated_at=new_key.rotated_at,
        invalidated_at=new_key.invalidated_at,
        invalidation_reason=new_key.invalidation_reason,
    )


@router.post("/invalidate", response_model=KeyDetailsResponse)
def invalidate_key(
    payload: InvalidateKeyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually invalidate / revoke a cryptographic session key."""
    transfer = (
        db.query(FileTransfer)
        .filter(
            FileTransfer.id == payload.transfer_id,
            or_(
                FileTransfer.sender_id == current_user.id,
                FileTransfer.receiver_id == current_user.id,
            ),
        )
        .first()
    )
    if not transfer:
        raise HTTPException(status_code=404, detail="File transfer not found or unauthorized.")

    session_key = (
        db.query(SessionKey)
        .filter(SessionKey.transfer_id == transfer.id, SessionKey.status == "ACTIVE")
        .order_by(desc(SessionKey.created_at))
        .first()
    )
    if not session_key:
        raise HTTPException(status_code=400, detail="No active session key found to invalidate.")

    reason = payload.reason or "Revoked manually by user."
    invalidated_key = KeyManagementService.invalidate_session_key(
        db=db,
        session_key=session_key,
        reason=reason,
        user_id=current_user.id,
        severity="WARNING",
    )

    return KeyDetailsResponse(
        id=invalidated_key.id,
        transfer_id=invalidated_key.transfer_id,
        original_filename=transfer.original_filename,
        status=invalidated_key.status,
        algorithm=invalidated_key.algorithm,
        key_size_bits=invalidated_key.key_size_bits,
        rotation_count=invalidated_key.rotation_count,
        created_at=invalidated_key.created_at,
        expires_at=invalidated_key.expires_at,
        rotated_at=invalidated_key.rotated_at,
        invalidated_at=invalidated_key.invalidated_at,
        invalidation_reason=invalidated_key.invalidation_reason,
    )


@router.get("/my-rsa")
def get_my_rsa_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve the current user's RSA public key and fingerprint."""
    user = KeyManagementService.ensure_user_keypair(db, current_user)
    return {
        "user_id": user.id,
        "email": user.email,
        "public_key_pem": user.rsa_public_key,
        "key_algorithm": "RSA-2048",
        "has_private_key": bool(user.rsa_private_key_encrypted),
    }


@router.post("/generate-rsa")
def regenerate_rsa_keypair(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a fresh RSA-2048 keypair for the current user."""
    from app.crypto.rsa import generate_rsa_keypair

    priv_pem, pub_pem = generate_rsa_keypair(2048)
    current_user.rsa_public_key = pub_pem
    current_user.rsa_private_key_encrypted = priv_pem
    db.commit()

    return {
        "status": "success",
        "message": "Generated fresh RSA-2048 keypair.",
        "public_key_pem": pub_pem,
    }
