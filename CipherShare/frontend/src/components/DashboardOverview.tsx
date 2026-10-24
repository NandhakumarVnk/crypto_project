import type { FC } from "react";
import type { FileTransfer, AuditSummary, UserResponse } from "../lib/types";
import type { ActiveTab } from "./Navbar";

interface DashboardOverviewProps {
  user: UserResponse;
  transfers: FileTransfer[];
  auditSummary: AuditSummary | null;
  onNavigate: (tab: ActiveTab) => void;
}

export const DashboardOverview: FC<DashboardOverviewProps> = ({
  user,
  transfers,
  auditSummary,
  onNavigate,
}) => {
  const activeTransfers = transfers.filter((t) => t.status === "ACTIVE").length;
  const decryptedTransfers = transfers.filter((t) => t.status === "DECRYPTED" || t.status === "COMPLETED").length;
  const recentTransfers = transfers.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-dark-600/60 bg-gradient-to-r from-dark-800 via-dark-800/90 to-dark-700/50 p-6 sm:p-8 backdrop-blur-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 right-40 h-48 w-48 rounded-full bg-cyan-500/10 blur-2xl" />

        <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-3 py-1 text-xs font-semibold text-accent-300">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent-400" />
              Adaptive Security Engine Online
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Welcome back, <span className="bg-gradient-to-r from-accent-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">{user.email}</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Your files are protected with unique AES-256 session keys wrapped via RSA-OAEP, verified through SHA-256 integrity checks, and dynamically regulated by contextual threat policies.
            </p>
          </div>

          <div className="flex shrink-0 gap-3">
            <button
              onClick={() => onNavigate("send")}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/20 transition-all hover:brightness-110"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Send Secure File
            </button>
            <button
              onClick={() => onNavigate("inbox")}
              className="flex items-center gap-2 rounded-xl border border-dark-500 bg-dark-700/60 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-dark-600 hover:text-white"
            >
              Check Inbox
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-dark-600/60 bg-dark-800/60 p-5 backdrop-blur-sm transition-all hover:border-accent-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Transfers</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 text-accent-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-white">{activeTransfers}</span>
            <span className="text-xs text-slate-400">files in transit</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">Regulated by dynamic expiration TTLs</div>
        </div>

        <div className="rounded-2xl border border-dark-600/60 bg-dark-800/60 p-5 backdrop-blur-sm transition-all hover:border-emerald-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Integrity Verified</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-emerald-400">
              {auditSummary ? auditSummary.integrity_verified : decryptedTransfers}
            </span>
            <span className="text-xs text-emerald-400/80">100% verified</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">SHA-256 digests validated without errors</div>
        </div>

        <div className="rounded-2xl border border-dark-600/60 bg-dark-800/60 p-5 backdrop-blur-sm transition-all hover:border-cyan-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Key Rotations</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-cyan-400">
              {auditSummary ? auditSummary.key_rotations : 0}
            </span>
            <span className="text-xs text-slate-400">adaptive re-keys</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">Proactive credential forward secrecy</div>
        </div>

        <div className="rounded-2xl border border-dark-600/60 bg-dark-800/60 p-5 backdrop-blur-sm transition-all hover:border-amber-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Security Events</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-amber-400">
              {auditSummary ? auditSummary.total_events : 0}
            </span>
            <span className="text-xs text-slate-400">audit records</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {auditSummary?.critical_events ? (
              <span className="text-red-400">{auditSummary.critical_events} critical alerts mitigated</span>
            ) : (
              <span className="text-emerald-400">Zero active critical alarms</span>
            )}
          </div>
        </div>
      </div>

      {/* Core Architecture Breakdown & Quick Action Panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Architecture Spotlight */}
        <div className="rounded-2xl border border-dark-600/60 bg-dark-800/50 p-6 backdrop-blur-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Adaptive Cryptographic Key Pipeline</h2>
              <p className="text-xs text-slate-400">Lifecycle execution mapping from upload to receiver decryption</p>
            </div>
            <span className="rounded-full bg-accent-500/10 px-2.5 py-1 text-xs font-semibold text-accent-400 ring-1 ring-accent-500/30">
              NIST Aligned
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-dark-600 bg-dark-900/60 p-4">
              <div className="text-xs font-bold text-accent-400">1. Characterization</div>
              <div className="mt-1 font-semibold text-slate-200">File Context</div>
              <p className="mt-1 text-xs text-slate-400">Extracts size, MIME type, and sensitivity level (Low to Critical).</p>
            </div>
            <div className="rounded-xl border border-dark-600 bg-dark-900/60 p-4">
              <div className="text-xs font-bold text-cyan-400">2. Policy Engine</div>
              <div className="mt-1 font-semibold text-slate-200">Adaptive Decision</div>
              <p className="mt-1 text-xs text-slate-400">Computes dynamic TTL, rotation quota, and AEAD cipher parameters.</p>
            </div>
            <div className="rounded-xl border border-dark-600 bg-dark-900/60 p-4">
              <div className="text-xs font-bold text-emerald-400">3. Hybrid Encrypt</div>
              <div className="mt-1 font-semibold text-slate-200">AES-256 + RSA</div>
              <p className="mt-1 text-xs text-slate-400">AES-GCM encrypts payload; RSA-OAEP wraps session key for recipient.</p>
            </div>
            <div className="rounded-xl border border-dark-600 bg-dark-900/60 p-4">
              <div className="text-xs font-bold text-indigo-400">4. SHA-256 Verify</div>
              <div className="mt-1 font-semibold text-slate-200">Integrity Check</div>
              <p className="mt-1 text-xs text-slate-400">Constant-time digest matching prevents tampering or silent bit decay.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dark-600/80 bg-dark-900/40 p-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Session Key Forward Secrecy</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <span>Zero Plaintext Stored on Server</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent-400" />
              <span>Real-Time Tamper Invalidation</span>
            </div>
          </div>
        </div>

        {/* Research Lab Quick Launch */}
        <div className="flex flex-col justify-between rounded-2xl border border-accent-500/30 bg-gradient-to-b from-dark-800/80 to-dark-800/40 p-6 backdrop-blur-sm">
          <div>
            <div className="inline-flex rounded-full bg-accent-500/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent-300 ring-1 ring-accent-500/30">
              Evaluation &amp; Validation
            </div>
            <h3 className="mt-3 text-lg font-bold text-white">Security &amp; Performance Lab</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Run interactive comparative cipher benchmarks (AES-128 vs AES-256 vs ChaCha20) and controlled attack simulations (Bit-flip tampering, expired key, rogue key).
            </p>
          </div>

          <div className="mt-6 space-y-2.5">
            <button
              onClick={() => onNavigate("experiments")}
              className="w-full rounded-xl bg-gradient-to-r from-accent-500 to-cyan-500 py-2.5 text-center text-xs font-semibold text-white shadow-md shadow-accent-500/20 transition-all hover:brightness-110"
            >
              Open Research &amp; Benchmark Lab
            </button>
            <button
              onClick={() => onNavigate("security")}
              className="w-full rounded-xl border border-dark-500/80 bg-dark-700/60 py-2.5 text-center text-xs font-semibold text-slate-300 transition-colors hover:bg-dark-600 hover:text-white"
            >
              View Real-Time Audit Trail
            </button>
          </div>
        </div>
      </div>

      {/* Recent Transfers Activity Table */}
      <div className="rounded-2xl border border-dark-600/60 bg-dark-800/50 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between pb-4 border-b border-dark-700">
          <div>
            <h2 className="text-base font-bold text-white">Recent File Transfers</h2>
            <p className="text-xs text-slate-400">Latest cryptographic transfer events involving your account</p>
          </div>
          <button
            onClick={() => onNavigate("inbox")}
            className="text-xs font-medium text-accent-400 hover:text-accent-300 transition-colors"
          >
            View All Inbox &rarr;
          </button>
        </div>

        {recentTransfers.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No transfers recorded yet. Click <span className="text-accent-400 font-semibold cursor-pointer" onClick={() => onNavigate("send")}>Send Secure File</span> to transfer your first encrypted file!
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-dark-700 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">File Name</th>
                  <th className="py-2.5 px-3">Sender / Recipient</th>
                  <th className="py-2.5 px-3">Sensitivity</th>
                  <th className="py-2.5 px-3">Cipher</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50 text-slate-300">
                {recentTransfers.map((t) => {
                  const isIncoming = t.receiver_id === user.id;
                  return (
                    <tr key={t.id} className="hover:bg-dark-700/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white">{t.original_filename}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          SHA: {t.original_sha256.slice(0, 12)}...
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {isIncoming ? (
                          <span>From <span className="text-accent-300">{t.sender_email}</span></span>
                        ) : (
                          <span>To <span className="text-cyan-300">{t.receiver_email}</span></span>
                        )}
                      </td>
                      <td className="py-3 px-3">
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
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                        {t.cipher_algorithm}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            t.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                              : t.status === "DECRYPTED"
                              ? "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20"
                              : "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isIncoming ? (
                          <button
                            onClick={() => onNavigate("inbox")}
                            className="rounded-lg bg-accent-500/20 px-2.5 py-1 text-[11px] font-medium text-accent-300 hover:bg-accent-500/30 transition-colors"
                          >
                            Decrypt
                          </button>
                        ) : (
                          <button
                            onClick={() => onNavigate("sent")}
                            className="rounded-lg bg-dark-700 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-dark-600 transition-colors"
                          >
                            Manage
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default DashboardOverview;
