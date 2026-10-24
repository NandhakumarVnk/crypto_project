/**
 * CipherShare — API utility layer.
 *
 * Centralises token storage, HTTP requests, file uploads/downloads,
 * cryptographic actions, and security operations.
 */

import type {
  HealthStatus,
  TokenResponse,
  UserResponse,
  UserRecipient,
  PolicyPreview,
  FileTransfer,
  KeyDetails,
  VerificationReport,
  SecurityEvent,
  AuditSummary,
  AttackSimulationResponse,
  BenchmarkItem,
  AdaptiveComparison,
} from "./types";

const TOKEN_KEY = "ciphershare_access_token";

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    const message =
      typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail: string }).detail)
        : `Request failed with status ${status}`;
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  const token = getToken();
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = { detail: response.statusText };
    }
    throw new ApiError(response.status, body);
  }

  return response.json() as Promise<T>;
}

export function parseErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as Record<string, unknown>;
    if (Array.isArray(body?.detail) && body.detail.length > 0) {
      const first = body.detail[0] as { msg?: string };
      return first.msg
        ? first.msg.replace(/^Value error, /, "")
        : err.message;
    }
    return err.message;
  }
  if (err instanceof TypeError) {
    return "Network error — is the backend running?";
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "An unexpected error occurred.";
}

// ---------------------------------------------------------------------------
// Authentication & Health
// ---------------------------------------------------------------------------

export async function apiHealthCheck(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/api/health");
}

export async function apiRegister(email: string, password: string): Promise<UserResponse> {
  return apiFetch<UserResponse>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function apiLogin(email: string, password: string): Promise<TokenResponse> {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  return apiFetch<TokenResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });
}

export async function apiGetMe(): Promise<UserResponse> {
  return apiFetch<UserResponse>("/api/auth/me");
}

// ---------------------------------------------------------------------------
// Transfers & Adaptive Policy
// ---------------------------------------------------------------------------

export async function apiPreviewPolicy(
  fileSizeBytes: number,
  filename: string,
  sensitivity: string = "MEDIUM",
  preferredCipher?: string
): Promise<PolicyPreview> {
  return apiFetch<PolicyPreview>("/api/transfers/preview-policy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_size_bytes: fileSizeBytes,
      filename,
      sensitivity,
      preferred_cipher: preferredCipher || undefined,
    }),
  });
}

export async function apiSendFile(formData: FormData): Promise<FileTransfer> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch("/api/transfers/send", {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = { detail: response.statusText };
    }
    throw new ApiError(response.status, body);
  }

  return response.json() as Promise<FileTransfer>;
}

export async function apiGetInbox(): Promise<FileTransfer[]> {
  return apiFetch<FileTransfer[]>("/api/transfers/inbox");
}

export async function apiGetSent(): Promise<FileTransfer[]> {
  return apiFetch<FileTransfer[]>("/api/transfers/sent");
}

export async function apiGetRecipients(): Promise<UserRecipient[]> {
  return apiFetch<UserRecipient[]>("/api/transfers/recipients");
}

export async function apiVerifyTransfer(transferId: number): Promise<VerificationReport> {
  return apiFetch<VerificationReport>(`/api/transfers/${transferId}/verify`, {
    method: "POST",
  });
}

export async function apiDownloadFile(transferId: number): Promise<{ blob: Blob; filename: string; sha256: string }> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`/api/transfers/${transferId}/download`, { headers });
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = { detail: response.statusText };
    }
    throw new ApiError(response.status, body);
  }

  const sha256 = response.headers.get("X-CipherShare-SHA256") || "";
  const disposition = response.headers.get("Content-Disposition") || "";
  let filename = "decrypted_file";
  const match = disposition.match(/filename="?([^";]+)"?/);
  if (match && match[1]) {
    filename = match[1];
  }

  const blob = await response.blob();
  return { blob, filename, sha256 };
}

// ---------------------------------------------------------------------------
// Key Management
// ---------------------------------------------------------------------------

export async function apiGetKeys(): Promise<KeyDetails[]> {
  return apiFetch<KeyDetails[]>("/api/keys");
}

export async function apiRotateKey(transferId: number, ttlSeconds?: number): Promise<KeyDetails> {
  return apiFetch<KeyDetails>("/api/keys/rotate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transfer_id: transferId, ttl_seconds: ttlSeconds }),
  });
}

export async function apiInvalidateKey(transferId: number, reason?: string): Promise<KeyDetails> {
  return apiFetch<KeyDetails>("/api/keys/invalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transfer_id: transferId, reason }),
  });
}

export async function apiGetMyRsa(): Promise<{
  user_id: number;
  email: string;
  public_key_pem: string;
  key_algorithm: string;
  has_private_key: boolean;
}> {
  return apiFetch("/api/keys/my-rsa");
}

export async function apiRegenerateRsa(): Promise<{
  status: string;
  message: string;
  public_key_pem: string;
}> {
  return apiFetch("/api/keys/generate-rsa", { method: "POST" });
}

// ---------------------------------------------------------------------------
// Security Monitoring & Simulations
// ---------------------------------------------------------------------------

export async function apiGetSecurityEvents(
  limit: number = 50,
  severity?: string,
  eventType?: string
): Promise<SecurityEvent[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (severity) params.append("severity", severity);
  if (eventType) params.append("event_type", eventType);

  return apiFetch<SecurityEvent[]>(`/api/security/events?${params.toString()}`);
}

export async function apiGetSecuritySummary(): Promise<AuditSummary> {
  return apiFetch<AuditSummary>("/api/security/summary");
}

export async function apiSimulateAttack(
  simulationType: "tampering" | "expired_key" | "invalid_key" | "brute_force",
  transferId?: number
): Promise<AttackSimulationResponse> {
  return apiFetch<AttackSimulationResponse>("/api/security/simulate-attack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ simulation_type: simulationType, transfer_id: transferId }),
  });
}

// ---------------------------------------------------------------------------
// Benchmarks & Comparative Analysis
// ---------------------------------------------------------------------------

export async function apiRunBenchmarks(fileSizeKb: number = 1024, iterations: number = 3): Promise<BenchmarkItem[]> {
  return apiFetch<BenchmarkItem[]>("/api/benchmarks/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_size_kb: fileSizeKb, iterations }),
  });
}

export async function apiCompareApproaches(): Promise<AdaptiveComparison> {
  return apiFetch<AdaptiveComparison>("/api/benchmarks/compare-approaches");
}
