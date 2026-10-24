import { useState, useEffect, useRef, type FC, type ChangeEvent } from "react";
import type { UserRecipient, PolicyPreview } from "../lib/types";
import {
  apiGetRecipients,
  apiPreviewPolicy,
  apiSendFile,
  parseErrorMessage,
} from "../lib/api";

interface SendFileViewProps {
  onTransferSuccess: () => void;
}

export const SendFileView: FC<SendFileViewProps> = ({ onTransferSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [recipients, setRecipients] = useState<UserRecipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | "">("");
  const [sensitivity, setSensitivity] = useState<string>("MEDIUM");
  const [preferredCipher, setPreferredCipher] = useState<string>("");
  const [policy, setPolicy] = useState<PolicyPreview | null>(null);
  const [loadingPolicy, setLoadingPolicy] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [sendStep, setSendStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load registered recipients
  useEffect(() => {
    apiGetRecipients()
      .then((data) => {
        setRecipients(data);
        if (data.length > 0) {
          setSelectedRecipientId(data[0].id);
        }
      })
      .catch((err) => setError(parseErrorMessage(err)));
  }, []);

  // Update policy preview whenever file, sensitivity, or cipher changes
  useEffect(() => {
    if (!file) {
      setPolicy(null);
      return;
    }
    setLoadingPolicy(true);
    apiPreviewPolicy(file.size, file.name, sensitivity, preferredCipher || undefined)
      .then((p) => {
        setPolicy(p);
        setLoadingPolicy(false);
      })
      .catch(() => setLoadingPolicy(false));
  }, [file, sensitivity, preferredCipher]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccessMsg(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
      setSuccessMsg(null);
    }
  };

  const handleSend = async () => {
    if (!file) {
      setError("Please select a file to transfer.");
      return;
    }
    if (!selectedRecipientId) {
      setError("Please select an authorized recipient user.");
      return;
    }

    setSending(true);
    setError(null);
    setSuccessMsg(null);
    setSendStep(1);

    // Visual step progression for user demonstration
    setTimeout(() => setSendStep(2), 250);
    setTimeout(() => setSendStep(3), 500);
    setTimeout(() => setSendStep(4), 750);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("receiver_id", String(selectedRecipientId));
    formData.append("sensitivity", sensitivity);
    if (preferredCipher) {
      formData.append("preferred_cipher", preferredCipher);
    }

    try {
      const result = await apiSendFile(formData);
      setSendStep(5);
      setSuccessMsg(`File '${result.original_filename}' successfully encrypted and dispatched to ${result.receiver_email}!`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => {
        onTransferSuccess();
      }, 1500);
    } catch (err) {
      setError(parseErrorMessage(err));
      setSendStep(0);
    } finally {
      setSending(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Send &amp; Encrypt File</h1>
        <p className="text-sm text-slate-400">
          Characterizes the file payload, dynamically resolves adaptive security rules, encrypts with unique AES-256 session keys, and encapsulates using recipient RSA-OAEP.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* Main Grid: Upload & Form on Left, Adaptive Policy Preview on Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left Form: 3 cols */}
        <div className="space-y-6 lg:col-span-3">
          {/* Drag & Drop File Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
              file
                ? "border-accent-500 bg-accent-500/5 ring-1 ring-accent-500/30"
                : "border-dark-600 bg-dark-800/40 hover:border-accent-500/50 hover:bg-dark-700/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-500/15 text-accent-400 group-hover:scale-105 transition-transform">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            {file ? (
              <div className="mt-3">
                <span className="font-semibold text-white">{file.name}</span>
                <p className="text-xs text-accent-300 font-mono mt-0.5">{formatBytes(file.size)}</p>
                <p className="mt-1 text-[11px] text-slate-400">Click or drop to replace file</p>
              </div>
            ) : (
              <div className="mt-3">
                <span className="text-sm font-semibold text-slate-200">
                  Drop your file here, or <span className="text-accent-400 underline underline-offset-2">browse</span>
                </span>
                <p className="mt-1 text-xs text-slate-500">Supports documents, archives, PDFs, keys, media (up to 50MB)</p>
              </div>
            )}
          </div>

          {/* Form Controls */}
          <div className="space-y-4 rounded-2xl border border-dark-600/60 bg-dark-800/60 p-6 backdrop-blur-sm">
            {/* Recipient Picker */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Authorized Recipient
              </label>
              <select
                value={selectedRecipientId}
                onChange={(e) => setSelectedRecipientId(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-dark-500 bg-dark-900 px-3.5 py-2.5 text-sm text-slate-200 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
              >
                {recipients.length === 0 ? (
                  <option value="">No other registered users available</option>
                ) : (
                  recipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.email} ({r.has_rsa_key ? "RSA Key Verified" : "Key Generated on Demand"})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Sensitivity Level Buttons */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Security Sensitivity Classification
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { id: "LOW", label: "Low", desc: "24h TTL · AES-128" },
                  { id: "MEDIUM", label: "Medium", desc: "4h TTL · AES-256" },
                  { id: "HIGH", label: "High", desc: "30m TTL · Strict" },
                  { id: "CRITICAL", label: "Critical", desc: "10m TTL · Single-Use" },
                ].map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setSensitivity(s.id)}
                    className={`flex flex-col items-center justify-center rounded-xl p-3 text-center transition-all ${
                      sensitivity === s.id
                        ? s.id === "CRITICAL"
                          ? "bg-red-500/20 text-red-300 ring-2 ring-red-500"
                          : s.id === "HIGH"
                          ? "bg-amber-500/20 text-amber-300 ring-2 ring-amber-500"
                          : s.id === "MEDIUM"
                          ? "bg-cyan-500/20 text-cyan-300 ring-2 ring-cyan-500"
                          : "bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500"
                        : "border border-dark-600 bg-dark-900/60 text-slate-400 hover:border-dark-500 hover:text-slate-300"
                    }`}
                  >
                    <span className="text-xs font-bold">{s.label}</span>
                    <span className="mt-0.5 text-[10px] opacity-75">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Cipher Configuration */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Cipher Preference (Optional Override)
              </label>
              <select
                value={preferredCipher}
                onChange={(e) => setPreferredCipher(e.target.value)}
                className="mt-2 w-full rounded-xl border border-dark-500 bg-dark-900 px-3.5 py-2.5 text-xs text-slate-300 focus:border-accent-500 focus:outline-none"
              >
                <option value="">Adaptive Policy Auto-Select (Recommended)</option>
                <option value="AES-256-GCM">AES-256-GCM (Authenticated Encryption)</option>
                <option value="AES-128-GCM">AES-128-GCM (High Throughput)</option>
                <option value="CHACHA20-POLY1305">ChaCha20-Poly1305 (Stream Cipher)</option>
              </select>
            </div>
          </div>

          {/* Encrypt & Transfer Button */}
          <button
            onClick={handleSend}
            disabled={sending || !file || !selectedRecipientId}
            className={`w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-lg transition-all ${
              sending || !file || !selectedRecipientId
                ? "cursor-not-allowed bg-dark-600 text-slate-500"
                : "bg-gradient-to-r from-accent-500 via-cyan-500 to-emerald-500 shadow-accent-500/25 hover:brightness-110 hover:shadow-xl"
            }`}
          >
            {sending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Encrypting &amp; Dispatching...
              </span>
            ) : (
              "Encrypt & Transfer Secure File"
            )}
          </button>

          {/* Progress Pipeline Visualization */}
          {sending && (
            <div className="rounded-xl border border-accent-500/30 bg-dark-900/90 p-4 space-y-2 text-xs">
              <div className="font-semibold text-accent-300">Cryptographic Pipeline Execution:</div>
              <div className="space-y-1 font-mono text-[11px] text-slate-400">
                <div className={sendStep >= 1 ? "text-emerald-400" : ""}>[1] File Characterization &amp; SHA-256 Digest</div>
                <div className={sendStep >= 2 ? "text-emerald-400" : ""}>[2] Adaptive Policy Engine Evaluation</div>
                <div className={sendStep >= 3 ? "text-emerald-400" : ""}>[3] Symmetric Session Key Generation ({policy?.cipher_algorithm})</div>
                <div className={sendStep >= 4 ? "text-emerald-400" : ""}>[4] AES-GCM Encrypt &amp; RSA-OAEP Key Encapsulation</div>
                <div className={sendStep >= 5 ? "text-emerald-400" : ""}>[5] Transfer Dispatch &amp; Audit Trail Record</div>
              </div>
            </div>
          )}
        </div>

        {/* Right Card: Adaptive Policy Preview (2 cols) */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-dark-600/70 bg-gradient-to-b from-dark-800 to-dark-800/60 p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Adaptive Policy Assessment
              </h2>
              {loadingPolicy && (
                <span className="text-[10px] text-cyan-400 animate-pulse">Evaluating...</span>
              )}
            </div>

            {policy ? (
              <div className="mt-4 space-y-4">
                {/* Risk score pill */}
                <div className="rounded-xl border border-dark-600 bg-dark-900/60 p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Threat / Risk Rating:</span>
                    <span
                      className={`font-bold ${
                        policy.risk_score >= 80
                          ? "text-red-400"
                          : policy.risk_score >= 50
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {policy.risk_score}/100 ({policy.threat_level})
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-dark-700">
                    <div
                      className={`h-full transition-all duration-500 ${
                        policy.risk_score >= 80
                          ? "bg-red-500"
                          : policy.risk_score >= 50
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${policy.risk_score}%` }}
                    />
                  </div>
                </div>

                {/* Key attributes grid */}
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl border border-dark-700 bg-dark-900/50 p-2.5">
                    <span className="text-[10px] text-slate-500 uppercase">Algorithm</span>
                    <div className="font-semibold text-slate-200 mt-0.5">{policy.cipher_algorithm}</div>
                  </div>
                  <div className="rounded-xl border border-dark-700 bg-dark-900/50 p-2.5">
                    <span className="text-[10px] text-slate-500 uppercase">Key Strength</span>
                    <div className="font-semibold text-slate-200 mt-0.5">{policy.key_size_bits}-bit AES</div>
                  </div>
                  <div className="rounded-xl border border-dark-700 bg-dark-900/50 p-2.5">
                    <span className="text-[10px] text-slate-500 uppercase">Validity TTL</span>
                    <div className="font-semibold text-cyan-300 mt-0.5">
                      {policy.ttl_seconds < 3600
                        ? `${policy.ttl_seconds / 60} minutes`
                        : `${policy.ttl_seconds / 3600} hours`}
                    </div>
                  </div>
                  <div className="rounded-xl border border-dark-700 bg-dark-900/50 p-2.5">
                    <span className="text-[10px] text-slate-500 uppercase">Download Quota</span>
                    <div className="font-semibold text-slate-200 mt-0.5">
                      {policy.max_downloads === 1 ? "1 (Single-Use)" : `${policy.max_downloads} downloads`}
                    </div>
                  </div>
                </div>

                {/* Decision Rationale */}
                <div className="rounded-xl border border-dark-700 bg-dark-900/40 p-3.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Policy Engine Rationale:
                  </div>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                    {policy.decision_reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-cyan-400 mt-0.5">&bull;</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="mt-8 text-center text-xs text-slate-500 py-6">
                Select a file to calculate dynamic cryptographic policy decisions.
              </div>
            )}
          </div>

          {/* RSA Key Encapsulation Note */}
          <div className="rounded-2xl border border-dark-700/60 bg-dark-900/40 p-4 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-300">
              <svg className="h-4 w-4 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Cryptographic Safeguards
            </div>
            <p className="leading-relaxed">
              Session keys never cross the network in plaintext. The unique AES session key is encapsulated with the recipient&apos;s RSA-2048 public key using OAEP padding with SHA-256.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SendFileView;
