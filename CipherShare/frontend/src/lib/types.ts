/**
 * CipherShare — API types matching backend schemas.
 */

export interface HealthStatus {
  status: string;
  version: string;
  app_name: string;
}

export interface UserResponse {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserRecipient {
  id: number;
  email: string;
  has_rsa_key: boolean;
  public_key_pem: string | null;
}

export interface PolicyPreview {
  sensitivity: string;
  cipher_algorithm: string;
  key_size_bits: number;
  ttl_seconds: number;
  max_downloads: number;
  rotation_threshold: number;
  integrity_algorithm: string;
  risk_score: number;
  threat_level: string;
  decision_reasons: string[];
}

export interface FileTransfer {
  id: number;
  sender_id: number;
  sender_email: string;
  receiver_id: number;
  receiver_email: string;
  original_filename: string;
  file_size_bytes: number;
  encrypted_size_bytes: number;
  mime_type: string;
  sensitivity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  original_sha256: string;
  cipher_algorithm: string;
  status: "ACTIVE" | "DECRYPTED" | "EXPIRED" | "COMPROMISED" | "REVOKED" | "COMPLETED" | string;
  download_count: number;
  max_downloads: number;
  key_status: "ACTIVE" | "ROTATED" | "EXPIRED" | "INVALIDATED" | null;
  key_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KeyDetails {
  id: number;
  transfer_id: number;
  original_filename: string;
  status: "ACTIVE" | "ROTATED" | "EXPIRED" | "INVALIDATED" | string;
  algorithm: string;
  key_size_bits: number;
  rotation_count: number;
  created_at: string;
  expires_at: string;
  rotated_at: string | null;
  invalidated_at: string | null;
  invalidation_reason: string | null;
}

export interface VerificationReport {
  transfer_id: number;
  filename: string;
  expected_sha256: string;
  computed_sha256: string;
  integrity_verified: boolean;
  cipher_algorithm: string;
  sensitivity: string;
  download_count: number;
  max_downloads: number;
}

export interface SecurityEvent {
  id: number;
  timestamp: string;
  event_type: string;
  severity: "INFO" | "WARNING" | "CRITICAL" | string;
  user_id: number | null;
  user_email: string | null;
  transfer_id: number | null;
  ip_address: string | null;
  description: string;
  details: Record<string, unknown> | null;
  mitigation_action: string | null;
}

export interface AuditSummary {
  total_events: number;
  critical_events: number;
  warning_events: number;
  integrity_failures: number;
  integrity_verified: number;
  key_rotations: number;
}

export interface AttackSimulationResponse {
  simulation_type: string;
  attack_detected: boolean;
  status: string;
  message: string;
  event_logged: string;
  mitigation_action: string;
  details: Record<string, unknown>;
}

export interface BenchmarkItem {
  algorithm: string;
  file_size_kb: number;
  encryption_time_ms: number;
  decryption_time_ms: number;
  key_generation_time_ms: number;
  throughput_mb_s: number;
  memory_peak_kb: number;
  integrity_verified: boolean;
}

export interface ApproachModel {
  name?: string;
  model_name?: string;
  cipher: string;
  key_validity: string;
  rotation_policy: string;
  threat_adaptation: string;
  single_use_support: boolean;
  key_management_overhead_ms: number;
  vulnerability_window_rating: string;
}

export interface AdaptiveComparison {
  fixed_approach: ApproachModel;
  adaptive_approach: ApproachModel;
  efficiency_gain_pct: number;
  security_advantage: string;
}
