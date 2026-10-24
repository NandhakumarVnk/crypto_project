"""File Integrity Verification Module using SHA-256.

Computes cryptographic hashes for file integrity, performs constant-time
verification, and provides attack-simulation bit-tampering functions.
"""

import hashlib
import hmac
import secrets


def compute_sha256(data: bytes) -> str:
    """Compute the SHA-256 digest of bytes and return lowercase hex string."""
    hasher = hashlib.sha256()
    hasher.update(data)
    return hasher.hexdigest().lower()


def compute_file_sha256(file_path: str, chunk_size: int = 65536) -> str:
    """Compute the SHA-256 digest of a file in streaming chunks for memory efficiency."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(chunk_size):
            hasher.update(chunk)
    return hasher.hexdigest().lower()


def verify_integrity(data: bytes, expected_sha256: str) -> bool:
    """Verify integrity of data against an expected SHA-256 hash in constant time."""
    actual_hash = compute_sha256(data)
    return hmac.compare_digest(actual_hash.lower(), expected_sha256.lower())


def tamper_bytes(data: bytes, flip_offset: int | None = None) -> bytes:
    """Tamper with data by flipping bits at a specified or random offset.

    Used by attack simulations to prove SHA-256 and AEAD integrity verification.
    """
    if not data:
        return b"\x01"

    byte_arr = bytearray(data)
    offset = (flip_offset if flip_offset is not None else len(byte_arr) // 2) % len(byte_arr)
    # Flip the lowest bit of the selected byte
    byte_arr[offset] ^= 0x01
    return bytes(byte_arr)
