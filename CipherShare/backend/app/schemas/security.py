"""Pydantic schemas for security events, audit logs, and attack simulations."""

from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.base import BaseSchema


class SecurityEventResponse(BaseSchema):
    id: int
    timestamp: datetime
    event_type: str
    severity: str
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    transfer_id: Optional[int] = None
    ip_address: Optional[str] = None
    description: str
    details: Optional[Dict[str, Any]] = None
    mitigation_action: Optional[str] = None


class AuditSummaryResponse(BaseModel):
    total_events: int
    critical_events: int
    warning_events: int
    integrity_failures: int
    integrity_verified: int
    key_rotations: int


class UserPublicInfo(BaseModel):
    id: int
    email: str
    has_rsa_key: bool
    public_key_pem: Optional[str] = None


class AttackSimulationRequest(BaseModel):
    simulation_type: str = Field(..., description="tampering, expired_key, invalid_key, or brute_force")
    transfer_id: Optional[int] = None


class AttackSimulationResponse(BaseModel):
    simulation_type: str
    attack_detected: bool
    status: str
    message: str
    event_logged: str
    mitigation_action: str
    details: Dict[str, Any]


class BenchmarkRunRequest(BaseModel):
    file_size_kb: int = Field(1024, ge=10, le=50000)
    iterations: int = Field(3, ge=1, le=10)


class BenchmarkItemResponse(BaseModel):
    algorithm: str
    file_size_kb: int
    encryption_time_ms: float
    decryption_time_ms: float
    key_generation_time_ms: float
    throughput_mb_s: float
    memory_peak_kb: float
    integrity_verified: bool


class AdaptiveComparisonResponse(BaseModel):
    fixed_approach: Dict[str, Any]
    adaptive_approach: Dict[str, Any]
    efficiency_gain_pct: float
    security_advantage: str
