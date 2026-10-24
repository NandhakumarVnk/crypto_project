"""AES and AEAD Symmetric Cryptographic Operations.

Supports AES-256-GCM, AES-128-GCM, and ChaCha20-Poly1305 authenticated encryption.
Provides cryptographically secure session key generation, authenticated encryption,
and authenticated decryption with tag verification.
"""

import os
import secrets
from typing import Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM, ChaCha20Poly1305


def generate_aes_key(key_size_bits: int = 256) -> bytes:
    """Generate a cryptographically secure random AES session key."""
    if key_size_bits not in (128, 256):
        raise ValueError(f"Unsupported AES key size: {key_size_bits}. Must be 128 or 256.")
    return secrets.token_bytes(key_size_bits // 8)


def generate_chacha_key() -> bytes:
    """Generate a 256-bit key for ChaCha20-Poly1305."""
    return secrets.token_bytes(32)


def encrypt_symmetric(
    plaintext: bytes,
    key: bytes,
    algorithm: str = "AES-256-GCM",
    associated_data: bytes | None = None,
) -> Tuple[bytes, bytes, bytes]:
    """Encrypt plaintext using the chosen AEAD cipher.

    Returns:
        (ciphertext, nonce_or_iv, auth_tag)
    Note: For AESGCM in cryptography library, ciphertext includes the 16-byte auth tag at the end.
    We split it out for explicit storage, verification, and forensic audit.
    """
    algo = algorithm.upper()
    if "CHACHA" in algo:
        nonce = secrets.token_bytes(12)
        cipher = ChaCha20Poly1305(key)
        ct_with_tag = cipher.encrypt(nonce, plaintext, associated_data)
        ciphertext = ct_with_tag[:-16]
        tag = ct_with_tag[-16:]
        return ciphertext, nonce, tag
    elif "AES" in algo:
        nonce = secrets.token_bytes(12)  # Standard 96-bit nonce for GCM
        aesgcm = AESGCM(key)
        ct_with_tag = aesgcm.encrypt(nonce, plaintext, associated_data)
        ciphertext = ct_with_tag[:-16]
        tag = ct_with_tag[-16:]
        return ciphertext, nonce, tag
    else:
        raise ValueError(f"Unsupported symmetric cipher algorithm: {algorithm}")


def decrypt_symmetric(
    ciphertext: bytes,
    key: bytes,
    nonce: bytes,
    tag: bytes,
    algorithm: str = "AES-256-GCM",
    associated_data: bytes | None = None,
) -> bytes:
    """Decrypt ciphertext using the chosen AEAD cipher and verify tag.

    Raises:
        cryptography.exceptions.InvalidTag: If the ciphertext or tag was tampered with.
    """
    algo = algorithm.upper()
    ct_with_tag = ciphertext + tag
    if "CHACHA" in algo:
        cipher = ChaCha20Poly1305(key)
        return cipher.decrypt(nonce, ct_with_tag, associated_data)
    elif "AES" in algo:
        aesgcm = AESGCM(key)
        return aesgcm.decrypt(nonce, ct_with_tag, associated_data)
    else:
        raise ValueError(f"Unsupported symmetric cipher algorithm: {algorithm}")
