import { useState, useEffect, type FC } from "react";
import type { FileTransfer } from "../lib/types";
import {
  apiRotateKey,
  apiInvalidateKey,
  parseErrorMessage,
} from "../lib/api";
import { formatExpiry, isDateExpired } from "../lib/dateUtils";

interface SentViewProps {
  transfers: FileTransfer[];
  onRefresh: () => void;
}

export const SentView: FC<SentViewProps> = ({ transfers, onRefresh }) => {
  const [rotatingId, setRotatingId] = useState<number | null>(null);
  const [invalidatingId, setInvalidatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Periodic tick to live-update key expiration countdowns
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRotate = async (transferId: number) => {
    setRotatingId(transferId);
    setError(null);
    setSuccess(null);
    try {
      await apiRotateKey(transferId);
      setSuccess(`Session key for transfer #${transferId} rotated successfully!`);
      onRefresh();
    } catch (err) {
      setError(parseErrorMessage(err));
    } finally {
      setRotatingId(null);
    }
  };

  const handleInvalidate = async (transferId: number) => {
    if (!confirm("Are you sure you want to revoke this session key? Decryption will be permanently blocked.")) {
      return;
    }
    setInvalidatingId(transferId);
    setError(null);
    setSuccess(null);
    try {
      await apiInvalidateKey(transferId, "Manually revoked by sender.");
      setSuccess(`Session key for transfer #${transferId} invalidated.`);
      onRefresh();
    } catch (err) {
      setError(parseErrorMessage(err));
    } finally {
      setInvalidatingId(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sent File Transfers</h1>
          <p className="text-sm text-slate-400">
            Monitor and manage outbound encrypted transfers, rotate session keys on demand, or revoke access immediately.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-dark-600 bg-dark-800 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-dark-700 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Transfers
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          {success}
        </div>
      )}

      {transfers.length === 0 ? (
        <div className="rounded-2xl border border-dark-600/60 bg-dark-800/40 py-16 text-center backdrop-blur-sm">
          <p className="text-sm text-slate-400">No outbound transfers initiated yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transfers.map((t) => {
            const isKeyActive = t.key_status === "ACTIVE";
            const expiryText = formatExpiry(t.key_expires_at);
            const isExpired = t.key_status === "EXPIRED" || (isKeyActive && isDateExpired(t.key_expires_at));

            return (
              <div
                key={t.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-dark-600/70 bg-dark-800/60 p-5 backdrop-blur-sm sm:flex-row sm:items-center"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-white">{t.original_filename}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        t.sensitivity === "CRITICAL"
                          ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30"
                          : t.sensitivity === "HIGH"
                          ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30"
                          : t.sensitivity === "MEDIUM"
                          ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30"
                          : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
                      }`}
                    >
                      {t.sensitivity}
                    </span>
                    <span className="rounded bg-dark-700 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                      {t.cipher_algorithm}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>
                      Recipient: <strong className="text-slate-300">{t.receiver_email}</strong>
                    </span>
                    <span>&bull;</span>
                    <span>Size: {formatBytes(t.file_size_bytes)}</span>
                    <span>&bull;</span>
                    <span>
                      Quota: {t.download_count} of {t.max_downloads} used
                    </span>
                    <span>&bull;</span>
                    <span
                      className={`font-semibold ${
                        isExpired
                          ? "text-red-400"
                          : isKeyActive
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      Key Status: {t.key_status || "UNKNOWN"} ({expiryText})
                    </span>
                  </div>

                  <div className="font-mono text-[11px] text-slate-500">
                    SHA-256 Digest: {t.original_sha256}
                  </div>
                </div>

                {/* Sender Controls */}
                <div className="flex shrink-0 items-center gap-2.5">
                  <button
                    onClick={() => handleRotate(t.id)}
                    disabled={rotatingId === t.id || !isKeyActive || isExpired}
                    className="flex items-center gap-1.5 rounded-xl border border-dark-500 bg-dark-700 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-40 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {rotatingId === t.id ? "Rotating..." : "Rotate Key"}
                  </button>

                  <button
                    onClick={() => handleInvalidate(t.id)}
                    disabled={invalidatingId === t.id || !isKeyActive}
                    className="flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    {invalidatingId === t.id ? "Revoking..." : "Revoke"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default SentView;
