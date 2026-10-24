import { useState, useEffect, type FC } from "react";
import type { FileTransfer, VerificationReport } from "../lib/types";
import {
  apiVerifyTransfer,
  apiDownloadFile,
  parseErrorMessage,
} from "../lib/api";
import { formatExpiry, isDateExpired } from "../lib/dateUtils";

interface InboxViewProps {
  transfers: FileTransfer[];
  onRefresh: () => void;
}

export const InboxView: FC<InboxViewProps> = ({ transfers, onRefresh }) => {
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [selectedReport, setSelectedReport] = useState<VerificationReport | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Periodic tick to live-update key expiration countdowns
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerifyOnly = async (transferId: number) => {
    setVerifyingId(transferId);
    setError(null);
    try {
      const report = await apiVerifyTransfer(transferId);
      setSelectedReport(report);
      setModalOpen(true);
      onRefresh();
    } catch (err) {
      setError(parseErrorMessage(err));
      onRefresh();
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDownloadAndVerify = async (transferId: number) => {
    setDownloadingId(transferId);
    setError(null);
    try {
      const { blob, filename } = await apiDownloadFile(transferId);

      // Trigger browser download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onRefresh();
    } catch (err) {
      setError(parseErrorMessage(err));
      onRefresh();
    } finally {
      setDownloadingId(null);
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Received Encrypted Files</h1>
          <p className="text-sm text-slate-400">
            Incoming files sent to your RSA public key. Decrypt with your private key and verify SHA-256 integrity.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-dark-600 bg-dark-800 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-dark-700 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Inbox
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      {transfers.length === 0 ? (
        <div className="rounded-2xl border border-dark-600/60 bg-dark-800/40 py-16 text-center backdrop-blur-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-dark-700 text-slate-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="mt-4 text-sm font-semibold text-white">Your inbox is empty</h3>
          <p className="mt-1 text-xs text-slate-500">
            Files shared with you will appear here with dynamic cryptographic protection.
          </p>
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
                className="group flex flex-col justify-between gap-4 rounded-2xl border border-dark-600/70 bg-dark-800/60 p-5 backdrop-blur-sm transition-all hover:border-accent-500/40 hover:bg-dark-800/80 sm:flex-row sm:items-center"
              >
                {/* Left File Information */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-white group-hover:text-accent-300 transition-colors">
                      {t.original_filename}
                    </span>
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
                      Sender: <strong className="text-slate-300">{t.sender_email}</strong>
                    </span>
                    <span>&bull;</span>
                    <span>Size: {formatBytes(t.file_size_bytes)}</span>
                    <span>&bull;</span>
                    <span>
                      Downloads: {t.download_count}/{t.max_downloads}
                    </span>
                    <span>&bull;</span>
                    <span
                      className={`font-semibold ${
                        isExpired
                          ? "text-red-400"
                          : isKeyActive
                          ? "text-cyan-400"
                          : "text-amber-400"
                      }`}
                    >
                      Key: {t.key_status || "UNKNOWN"} ({expiryText})
                    </span>
                  </div>

                  <div className="font-mono text-[11px] text-slate-500">
                    Original SHA-256 Digest: {t.original_sha256}
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex shrink-0 items-center gap-2.5">
                  <button
                    onClick={() => handleVerifyOnly(t.id)}
                    disabled={verifyingId === t.id || isExpired || !isKeyActive}
                    className="rounded-xl border border-dark-500 bg-dark-700/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-dark-600 hover:text-white disabled:opacity-40 transition-colors"
                  >
                    {verifyingId === t.id ? "Checking..." : "Verify Hash"}
                  </button>

                  <button
                    onClick={() => handleDownloadAndVerify(t.id)}
                    disabled={downloadingId === t.id || isExpired || !isKeyActive}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-accent-500/20 hover:brightness-110 disabled:opacity-40 transition-all"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {downloadingId === t.id ? "Decrypting..." : "Decrypt & Download"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Verification Report Modal */}
      {modalOpen && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-dark-600 bg-dark-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-dark-700">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white">SHA-256 Integrity Verified</h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Cryptographic integrity verification passed! The computed SHA-256 hash of the decrypted payload matches the original sender hash bit-for-bit, guaranteeing zero data tampering.
            </p>

            <div className="space-y-2 rounded-xl bg-dark-900/70 p-3.5 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">File:</span>
                <span className="text-slate-200 font-sans font-semibold">{selectedReport.filename}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Expected SHA-256:</span>
                <span className="text-emerald-400 break-all">{selectedReport.expected_sha256}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Computed SHA-256:</span>
                <span className="text-emerald-400 break-all">{selectedReport.computed_sha256}</span>
              </div>
              <div className="pt-1 flex justify-between text-[11px] text-slate-400 font-sans">
                <span>Cipher: {selectedReport.cipher_algorithm}</span>
                <span>Downloads: {selectedReport.download_count}/{selectedReport.max_downloads}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-dark-600 bg-dark-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-dark-600"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setModalOpen(false);
                  handleDownloadAndVerify(selectedReport.transfer_id);
                }}
                className="rounded-xl bg-gradient-to-r from-accent-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-accent-500/20 hover:brightness-110"
              >
                Download File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default InboxView;
