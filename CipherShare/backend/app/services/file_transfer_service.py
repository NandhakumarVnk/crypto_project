"""File Transfer Service for CipherShare.

Coordinates the end-to-end workflow:
1. File characterization (size, type, sensitivity)
2. Adaptive Security Policy evaluation
3. AES-256/AEAD file encryption & SHA-256 integrity hashing
4. RSA-OAEP session key encapsulation
5. Secure storage and transfer management
6. Receiver RSA decryption, AES decryption, and SHA-256 integrity verification
7. Tamper detection and automatic key invalidation
"""

import base64
import os
import uuid
import json
from datetime import datetime, timezone, timedelta
from typing import Tuple, Dict, Any, Optional
from cryptography.exceptions import InvalidTag
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.config import settings
from app.models.user import User
from app.models.file_transfer import FileTransfer
from app.models.session_key import SessionKey
from app.crypto.aes import (
    generate_aes_key,
    generate_chacha_key,
    encrypt_symmetric,
    decrypt_symmetric,
)
from app.crypto.rsa import (
    encrypt_session_key_with_rsa,
    decrypt_session_key_with_rsa,
)
from app.crypto.integrity import (
    compute_sha256,
    verify_integrity,
    tamper_bytes,
)
from app.crypto.adaptive_policy import AdaptiveSecurityPolicyEngine
from app.services.key_management_service import KeyManagementService
from app.services.security_event_service import SecurityEventService


class FileTransferService:
    @staticmethod
    def create_transfer(
        db: Session,
        sender: User,
        receiver_id: int,
        filename: str,
        content: bytes,
        sensitivity: str = "MEDIUM",
        preferred_cipher: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> FileTransfer:
        """Execute the sender encryption and transfer workflow."""
        if sender.id == receiver_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sender and receiver cannot be the same user in CipherShare.",
            )

        receiver = db.query(User).filter(User.id == receiver_id).first()
        if not receiver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recipient user not found.",
            )

        # 1. Ensure both users have valid RSA keypairs
        KeyManagementService.ensure_user_keypair(db, sender)
        KeyManagementService.ensure_user_keypair(db, receiver)

        # 2. File Characterization
        file_size_bytes = len(content)
        mime_type = "application/octet-stream"
        ext = os.path.splitext(filename)[1].lower()
        if ext in (".txt", ".md", ".csv", ".json"):
            mime_type = "text/plain"
        elif ext in (".pdf",):
            mime_type = "application/pdf"
        elif ext in (".png", ".jpg", ".jpeg"):
            mime_type = "image/" + ext.strip(".")
        elif ext in (".zip", ".tar", ".gz"):
            mime_type = "application/zip"

        # 3. Context analysis: count recent security incidents
        recent_incidents = SecurityEventService.get_recent_incidents_count(db, user_id=sender.id)

        # 4. Adaptive Security Policy evaluation
        policy = AdaptiveSecurityPolicyEngine.evaluate(
            file_size_bytes=file_size_bytes,
            filename=filename,
            sensitivity=sensitivity,
            recent_security_incidents=recent_incidents,
            preferred_cipher=preferred_cipher,
        )

        # 5. Compute SHA-256 integrity hash of original plaintext
        original_sha256 = compute_sha256(content)

        # 6. Generate symmetric session key
        if "CHACHA" in policy.cipher_algorithm:
            raw_session_key = generate_chacha_key()
        else:
            raw_session_key = generate_aes_key(policy.key_size_bits)

        # 7. Encrypt file with AEAD cipher
        ciphertext, nonce, tag = encrypt_symmetric(
            plaintext=content,
            key=raw_session_key,
            algorithm=policy.cipher_algorithm,
        )

        # 8. Encrypt AES session key with recipient's RSA public key (RSA-OAEP)
        encrypted_session_key = encrypt_session_key_with_rsa(
            session_key=raw_session_key,
            public_key_pem=receiver.rsa_public_key,
        )

        # 9. Store encrypted file on disk
        os.makedirs(settings.upload_dir, exist_ok=True)
        stored_filename = f"{uuid.uuid4().hex}_{os.path.basename(filename)}.enc"
        file_path = os.path.join(settings.upload_dir, stored_filename)
        with open(file_path, "wb") as f:
            f.write(ciphertext)

        # 10. Persist FileTransfer record
        now = datetime.now(timezone.utc)
        transfer = FileTransfer(
            sender_id=sender.id,
            receiver_id=receiver.id,
            original_filename=os.path.basename(filename),
            stored_filename=stored_filename,
            file_size_bytes=file_size_bytes,
            encrypted_size_bytes=len(ciphertext),
            mime_type=mime_type,
            sensitivity=policy.sensitivity,
            original_sha256=original_sha256,
            cipher_algorithm=policy.cipher_algorithm,
            status="ACTIVE",
            download_count=0,
            max_downloads=policy.max_downloads,
            policy_applied=json.dumps(policy.to_dict()),
            created_at=now,
            updated_at=now,
        )
        db.add(transfer)
        db.commit()
        db.refresh(transfer)

        # 11. Persist SessionKey record
        expires_at = now + timedelta(seconds=policy.ttl_seconds)
        session_key = SessionKey(
            transfer_id=transfer.id,
            encrypted_session_key=base64.b64encode(encrypted_session_key).decode("ascii"),
            nonce_or_iv=base64.b64encode(nonce).decode("ascii"),
            auth_tag=base64.b64encode(tag).decode("ascii") if tag else None,
            status="ACTIVE",
            algorithm=policy.cipher_algorithm,
            key_size_bits=policy.key_size_bits,
            rotation_count=0,
            created_at=now,
            expires_at=expires_at,
        )
        db.add(session_key)
        db.commit()
        db.refresh(session_key)

        # 12. Security event audit logs
        SecurityEventService.log_event(
            db=db,
            event_type="FILE_ENCRYPTED",
            description=f"Encrypted file '{filename}' using {policy.cipher_algorithm} (Sensitivity: {policy.sensitivity})",
            severity="INFO",
            user_id=sender.id,
            transfer_id=transfer.id,
            ip_address=ip_address,
            details={
                "original_sha256": original_sha256,
                "file_size": file_size_bytes,
                "encrypted_size": len(ciphertext),
                "cipher": policy.cipher_algorithm,
            },
        )
        SecurityEventService.log_event(
            db=db,
            event_type="KEY_GENERATED",
            description=f"Generated {policy.key_size_bits}-bit AES session key, wrapped with RSA-OAEP for recipient #{receiver.id}",
            severity="INFO",
            user_id=sender.id,
            transfer_id=transfer.id,
            details={"key_size_bits": policy.key_size_bits, "ttl_seconds": policy.ttl_seconds},
        )
        SecurityEventService.log_event(
            db=db,
            event_type="FILE_TRANSFERRED",
            description=f"File transfer #{transfer.id} initiated from {sender.email} to {receiver.email}",
            severity="INFO",
            user_id=sender.id,
            transfer_id=transfer.id,
            ip_address=ip_address,
        )

        return transfer

    @staticmethod
    def decrypt_and_verify(
        db: Session,
        transfer_id: int,
        user: User,
        ip_address: Optional[str] = None,
        simulate_tampering: bool = False,
    ) -> Tuple[bytes, str, str, Dict[str, Any]]:
        """Decrypt file, verify SHA-256 integrity, handle key lifecycle and tamper detection.

        Returns:
            (plaintext_bytes, filename, mime_type, verification_report)
        """
        transfer = db.query(FileTransfer).filter(FileTransfer.id == transfer_id).first()
        if not transfer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File transfer not found.",
            )

        # Ensure user is the authorized recipient (or sender for auditing)
        if user.id != transfer.receiver_id and user.id != transfer.sender_id:
            SecurityEventService.log_event(
                db=db,
                event_type="UNAUTHORIZED_ACCESS",
                description=f"User #{user.id} ({user.email}) attempted unauthorized decryption of transfer #{transfer.id}",
                severity="WARNING",
                user_id=user.id,
                transfer_id=transfer.id,
                ip_address=ip_address,
                mitigation_action="Access denied with HTTP 403 Forbidden.",
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not authorized to decrypt this file transfer.",
            )

        # Get active session key
        session_key = (
            db.query(SessionKey)
            .filter(SessionKey.transfer_id == transfer.id, SessionKey.status == "ACTIVE")
            .order_by(desc(SessionKey.created_at))
            .first()
        )
        if not session_key:
            # Check if there is an expired or invalidated key
            latest_key = (
                db.query(SessionKey)
                .filter(SessionKey.transfer_id == transfer.id)
                .order_by(desc(SessionKey.created_at))
                .first()
            )
            status_desc = latest_key.status if latest_key else "UNKNOWN"
            SecurityEventService.log_event(
                db=db,
                event_type="INVALID_KEY",
                description=f"Decryption attempt failed: No active session key available (Status: {status_desc})",
                severity="WARNING",
                user_id=user.id,
                transfer_id=transfer.id,
                ip_address=ip_address,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Decryption denied: Session key is {status_desc}. Please request a key rotation.",
            )

        # Check key expiration
        is_valid = KeyManagementService.check_and_update_expiry(db, session_key)
        if not is_valid:
            SecurityEventService.log_event(
                db=db,
                event_type="EXPIRED_KEY_ATTEMPT",
                description=f"Decryption rejected: Session key #{session_key.id} has expired",
                severity="WARNING",
                user_id=user.id,
                transfer_id=transfer.id,
                ip_address=ip_address,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Decryption denied: The cryptographic session key has expired according to adaptive policy.",
            )

        # Check download limits
        if transfer.download_count >= transfer.max_downloads:
            KeyManagementService.invalidate_session_key(
                db=db,
                session_key=session_key,
                reason="Maximum download limit reached for this transfer.",
                user_id=user.id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Decryption denied: Maximum allowed downloads reached for this transfer session.",
            )

        # Decrypt session key using receiver's RSA private key
        receiver = transfer.receiver
        if not receiver.rsa_private_key_encrypted:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Recipient cryptographic private key is missing on server.",
            )

        try:
            enc_key_bytes = base64.b64decode(session_key.encrypted_session_key)
            raw_session_key = decrypt_session_key_with_rsa(
                encrypted_session_key=enc_key_bytes,
                private_key_pem=receiver.rsa_private_key_encrypted,
            )
        except Exception as exc:
            SecurityEventService.log_event(
                db=db,
                event_type="INVALID_KEY",
                description=f"RSA-OAEP session key recovery failed: {str(exc)}",
                severity="CRITICAL",
                user_id=user.id,
                transfer_id=transfer.id,
                ip_address=ip_address,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to decrypt session key with recipient RSA private key.",
            )

        # Read encrypted file from storage
        file_path = os.path.join(settings.upload_dir, transfer.stored_filename)
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Encrypted file not found on server storage.",
            )

        with open(file_path, "rb") as f:
            ciphertext = f.read()

        # Attack simulation: bit tampering
        if simulate_tampering:
            ciphertext = tamper_bytes(ciphertext)

        nonce = base64.b64decode(session_key.nonce_or_iv)
        tag = base64.b64decode(session_key.auth_tag) if session_key.auth_tag else b""

        # Decrypt ciphertext
        try:
            plaintext = decrypt_symmetric(
                ciphertext=ciphertext,
                key=raw_session_key,
                nonce=nonce,
                tag=tag,
                algorithm=transfer.cipher_algorithm,
            )
        except (InvalidTag, Exception) as exc:
            # Tampering or corruption detected by AEAD tag!
            KeyManagementService.invalidate_session_key(
                db=db,
                session_key=session_key,
                reason="Tampering detected: AEAD authentication tag verification failed.",
                user_id=user.id,
                severity="CRITICAL",
            )
            transfer.status = "COMPROMISED"
            db.commit()

            SecurityEventService.log_event(
                db=db,
                event_type="INTEGRITY_FAILURE",
                description="Tampering detected! AEAD tag mismatch or ciphertext corruption.",
                severity="CRITICAL",
                user_id=user.id,
                transfer_id=transfer.id,
                ip_address=ip_address,
                details={"error": str(exc), "simulated": simulate_tampering},
                mitigation_action="Session key invalidated immediately and transfer quarantined.",
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SECURITY ALERT: Integrity check failed! Ciphertext corruption or tampering detected.",
            )

        # Verify SHA-256 integrity hash of decrypted plaintext
        actual_sha256 = compute_sha256(plaintext)
        integrity_ok = verify_integrity(plaintext, transfer.original_sha256)

        if not integrity_ok:
            KeyManagementService.invalidate_session_key(
                db=db,
                session_key=session_key,
                reason="SHA-256 integrity digest mismatch.",
                user_id=user.id,
                severity="CRITICAL",
            )
            transfer.status = "COMPROMISED"
            db.commit()

            SecurityEventService.log_event(
                db=db,
                event_type="INTEGRITY_FAILURE",
                description="SHA-256 file integrity check failed! Expected hash does not match computed hash.",
                severity="CRITICAL",
                user_id=user.id,
                transfer_id=transfer.id,
                ip_address=ip_address,
                details={
                    "expected_sha256": transfer.original_sha256,
                    "actual_sha256": actual_sha256,
                },
                mitigation_action="File transfer invalidated and quarantined.",
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SECURITY ALERT: SHA-256 integrity verification failed! File content has been modified.",
            )

        # Integrity verified successfully!
        transfer.download_count += 1
        transfer.status = "DECRYPTED"

        # Check if single-use or max downloads reached
        if transfer.download_count >= transfer.max_downloads:
            session_key.status = "INVALIDATED"
            session_key.invalidated_at = datetime.now(timezone.utc)
            session_key.invalidation_reason = "Single-use / Maximum downloads reached (Adaptive Security Policy)"
            transfer.status = "COMPLETED"

        db.commit()

        SecurityEventService.log_event(
            db=db,
            event_type="INTEGRITY_VERIFIED",
            description=f"SHA-256 integrity verified for file '{transfer.original_filename}'",
            severity="INFO",
            user_id=user.id,
            transfer_id=transfer.id,
            ip_address=ip_address,
            details={"sha256": actual_sha256, "matches": True},
        )
        SecurityEventService.log_event(
            db=db,
            event_type="FILE_DECRYPTED",
            description=f"Successfully decrypted file '{transfer.original_filename}' for {user.email}",
            severity="INFO",
            user_id=user.id,
            transfer_id=transfer.id,
            ip_address=ip_address,
            details={"download_count": transfer.download_count, "max_downloads": transfer.max_downloads},
        )

        verification_report = {
            "transfer_id": transfer.id,
            "filename": transfer.original_filename,
            "expected_sha256": transfer.original_sha256,
            "computed_sha256": actual_sha256,
            "integrity_verified": True,
            "cipher_algorithm": transfer.cipher_algorithm,
            "sensitivity": transfer.sensitivity,
            "download_count": transfer.download_count,
            "max_downloads": transfer.max_downloads,
        }

        return plaintext, transfer.original_filename, transfer.mime_type, verification_report
