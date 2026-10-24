"""Pydantic schemas for file transfer and key management."""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


from app.schemas.base import BaseSchema


class PolicyPreviewRequest(BaseModel):
    file_size_bytes: int = Field(..., ge=0)
    filename: str = Field(..., min_length=1)
    sensitivity: str = Field("MEDIUM")
    preferred_cipher: Optional[str] = None


class PolicyPreviewResponse(BaseModel):
    sensitivity: str
    cipher_algorithm: str
    key_size_bits: int
    ttl_seconds: int
    max_downloads: int
    rotation_threshold: int
    integrity_algorithm: str
    risk_score: int
    threat_level: str
    decision_reasons: List[str]


class FileTransferResponse(BaseSchema):
    id: int
    sender_id: int
    sender_email: str
    receiver_id: int
    receiver_email: str
    original_filename: str
    file_size_bytes: int
    encrypted_size_bytes: int
    mime_type: str
    sensitivity: str
    original_sha256: str
    cipher_algorithm: str
    status: str
    download_count: int
    max_downloads: int
    key_status: Optional[str] = None
    key_expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class KeyDetailsResponse(BaseSchema):
    id: int
    transfer_id: int
    original_filename: str
    status: str
    algorithm: str
    key_size_bits: int
    rotation_count: int
    created_at: datetime
    expires_at: datetime
    rotated_at: Optional[datetime] = None
    invalidated_at: Optional[datetime] = None
    invalidation_reason: Optional[str] = None


class VerificationReportResponse(BaseModel):
    transfer_id: int
    filename: str
    expected_sha256: str
    computed_sha256: str
    integrity_verified: bool
    cipher_algorithm: str
    sensitivity: str
    download_count: int
    max_downloads: int


class RotateKeyRequest(BaseModel):
    transfer_id: int
    ttl_seconds: Optional[int] = None


class InvalidateKeyRequest(BaseModel):
    transfer_id: int
    reason: Optional[str] = None
