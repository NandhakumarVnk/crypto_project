"""Key Management Service for CipherShare.

Manages asymmetric user RSA keypairs and symmetric session key lifecycles:
generation, expiration checks, rotation, and invalidation.
"""

import base64
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.user import User
from app.models.file_transfer import FileTransfer
from app.models.session_key import SessionKey
from app.crypto.rsa import (
    generate_rsa_keypair,
    encrypt_session_key_with_rsa,
    decrypt_session_key_with_rsa,
)
from app.crypto.aes import (
    generate_aes_key,
    encrypt_symmetric,
    decrypt_symmetric,
)
from app.services.security_event_service import SecurityEventService


class KeyManagementService:
    @staticmethod
    def ensure_user_keypair(db: Session, user: User) -> User:
        """Ensure the user has an RSA keypair for key encapsulation."""
        if not user.rsa_public_key or not user.rsa_private_key_encrypted:
            priv_pem, pub_pem = generate_rsa_keypair(2048)
            user.rsa_public_key = pub_pem
            user.rsa_private_key_encrypted = priv_pem
            db.commit()
            db.refresh(user)

            SecurityEventService.log_event(
                db=db,
                event_type="KEY_GENERATED",
                description=f"Generated new 2048-bit RSA keypair for user {user.email}",
                severity="INFO",
                user_id=user.id,
                details={"key_type": "RSA-2048", "fingerprint": pub_pem[:60] + "..."},
            )
        return user

    @staticmethod
    def check_and_update_expiry(db: Session, session_key: SessionKey) -> bool:
        """Check if a session key has passed its expiration time.

        If expired and still marked ACTIVE, updates status to EXPIRED.
        Returns True if the key is ACTIVE and not expired, False otherwise.
        """
        if session_key.status != "ACTIVE":
            return False

        now = datetime.now(timezone.utc)
        # Ensure timezone-aware comparison
        exp = session_key.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)

        if now > exp:
            session_key.status = "EXPIRED"
            session_key.invalidated_at = now
            session_key.invalidation_reason = "Session key validity TTL expired"

            if session_key.transfer and session_key.transfer.status == "ACTIVE":
                session_key.transfer.status = "EXPIRED"

            db.commit()

            SecurityEventService.log_event(
                db=db,
                event_type="KEY_EXPIRED",
                description=f"Session key #{session_key.id} for transfer #{session_key.transfer_id} has expired",
                severity="WARNING",
                transfer_id=session_key.transfer_id,
                details={"expired_at": exp.isoformat()},
            )
            return False

        return True

    @staticmethod
    def invalidate_session_key(
        db: Session,
        session_key: SessionKey,
        reason: str,
        user_id: Optional[int] = None,
        severity: str = "WARNING",
    ) -> SessionKey:
        """Immediately invalidate a session key and prevent further decryption."""
        now = datetime.now(timezone.utc)
        session_key.status = "INVALIDATED"
        session_key.invalidated_at = now
        session_key.invalidation_reason = reason

        if session_key.transfer:
            session_key.transfer.status = "REVOKED"

        db.commit()
        db.refresh(session_key)

        SecurityEventService.log_event(
            db=db,
            event_type="KEY_INVALIDATED",
            description=f"Session key #{session_key.id} invalidated: {reason}",
            severity=severity,
            user_id=user_id,
            transfer_id=session_key.transfer_id,
            details={"reason": reason},
            mitigation_action="Revoked key access and disabled decryption endpoint.",
        )
        return session_key

    @staticmethod
    def rotate_session_key(
        db: Session,
        transfer: FileTransfer,
        operator: User,
        storage_dir: str,
        ttl_seconds: Optional[int] = None,
    ) -> SessionKey:
        """Rotate the session key for an active file transfer.

        Decrypts file with current key, generates fresh session key,
        re-encrypts file, wraps new key with recipient's RSA public key,
        marks old key ROTATED, and activates new key.
        """
        # Find active session key
        old_key = (
            db.query(SessionKey)
            .filter(SessionKey.transfer_id == transfer.id, SessionKey.status == "ACTIVE")
            .order_by(desc(SessionKey.created_at))
            .first()
        )
        if not old_key:
            raise ValueError("No active session key found to rotate.")

        # Ensure receiver has RSA keypair
        receiver = transfer.receiver
        if not receiver.rsa_public_key:
            KeyManagementService.ensure_user_keypair(db, receiver)

        # Decrypt session key using receiver's private key (or decrypt file)
        enc_old_key_bytes = base64.b64decode(old_key.encrypted_session_key)
        raw_old_aes_key = decrypt_session_key_with_rsa(enc_old_key_bytes, receiver.rsa_private_key_encrypted)

        # Read encrypted file
        file_path = os.path.join(storage_dir, transfer.stored_filename)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Encrypted file not found on server storage: {file_path}")

        with open(file_path, "rb") as f:
            ciphertext = f.read()

        old_nonce = base64.b64decode(old_key.nonce_or_iv)
        old_tag = base64.b64decode(old_key.auth_tag) if old_key.auth_tag else b""

        # Recover plaintext
        plaintext = decrypt_symmetric(ciphertext, raw_old_aes_key, old_nonce, old_tag, transfer.cipher_algorithm)

        # Generate new AES session key
        new_key_size = old_key.key_size_bits
        new_raw_aes_key = generate_aes_key(new_key_size)

        # Re-encrypt file
        new_ciphertext, new_nonce, new_tag = encrypt_symmetric(
            plaintext, new_raw_aes_key, transfer.cipher_algorithm
        )

        with open(file_path, "wb") as f:
            f.write(new_ciphertext)

        # Wrap new AES key with receiver's RSA public key
        new_enc_key_bytes = encrypt_session_key_with_rsa(new_raw_aes_key, receiver.rsa_public_key)

        # Mark old key as ROTATED
        now = datetime.now(timezone.utc)
        old_key.status = "ROTATED"
        old_key.rotated_at = now

        # Compute new expiration
        ttl = ttl_seconds if ttl_seconds is not None else 3600
        new_expires_at = now + timedelta(seconds=ttl)

        new_session_key = SessionKey(
            transfer_id=transfer.id,
            encrypted_session_key=base64.b64encode(new_enc_key_bytes).decode("ascii"),
            nonce_or_iv=base64.b64encode(new_nonce).decode("ascii"),
            auth_tag=base64.b64encode(new_tag).decode("ascii"),
            status="ACTIVE",
            algorithm=transfer.cipher_algorithm,
            key_size_bits=new_key_size,
            rotation_count=old_key.rotation_count + 1,
            created_at=now,
            expires_at=new_expires_at,
        )
        db.add(new_session_key)

        transfer.encrypted_size_bytes = len(new_ciphertext)
        transfer.status = "ACTIVE"
        db.commit()
        db.refresh(new_session_key)

        SecurityEventService.log_event(
            db=db,
            event_type="KEY_ROTATED",
            description=f"Rotated session key for transfer #{transfer.id} (version {new_session_key.rotation_count})",
            severity="INFO",
            user_id=operator.id,
            transfer_id=transfer.id,
            details={
                "previous_key_id": old_key.id,
                "new_key_id": new_session_key.id,
                "rotation_count": new_session_key.rotation_count,
            },
        )
        return new_session_key
