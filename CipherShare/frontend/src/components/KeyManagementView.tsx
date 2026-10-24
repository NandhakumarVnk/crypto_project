import { useState, useEffect, type FC } from "react";
import type { KeyDetails } from "../lib/types";
import {
  apiGetKeys,
  apiRotateKey,
  apiInvalidateKey,
  apiGetMyRsa,
  apiRegenerateRsa,
  parseErrorMessage,
} from "../lib/api";
import { formatLocalDateTime, formatExpiry } from "../lib/dateUtils";

export const KeyManagementView: FC = () => {
  const [keys, setKeys] = useState<KeyDetails[]>([]);
  const [rsaInfo, setRsaInfo] = useState<{
    user_id: number;
    email: string;
    public_key_pem: string;
    key_algorithm: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([apiGetKeys(), apiGetMyRsa()])
      .then(([kList, rsa]) => {
        setKeys(kList);
        setRsaInfo(rsa);
        setLoading(false);
      })
      .catch((err) => {
        setError(parseErrorMessage(err));
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyRsa = () => {
    if (rsaInfo?.public_key_pem) {
      navigator.clipboard.writeText(rsaInfo.public_key_pem);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerateRsa = async () => {
    if (!confirm("Regenerate your RSA keypair? Existing active transfers encrypted for your previous key will require re-keying.")) {
      return;
    }
    try {
      await apiRegenerateRsa();
      setActionMsg("Generated fresh RSA-2048 keypair successfully!");
      loadData();
    } catch (err) {
      setError(parseErrorMessage(err));
    }
  };

  const handleRotate = async (transferId: number) => {
    try {
      await apiRotateKey(transferId);
      setActionMsg(`Rotated session key for transfer #${transferId}!`);
      loadData();
    } catch (err) {
      setError(parseErrorMessage(err));
    }
  };

  const handleInvalidate = async (transferId: number) => {
    try {
      await apiInvalidateKey(transferId, "Revoked from Key Management Hub.");
      setActionMsg(`Revoked session key for transfer #${transferId}!`);
      loadData();
    } catch (err) {
      setError(parseErrorMessage(err));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Cryptographic Key Lifecycle Hub</h1>
        <p className="text-sm text-slate-400">
          Enforces dynamic session key lifecycles: automated rotation, forward secrecy, temporal expiration (TTL), and instant tamper invalidation.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {actionMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          {actionMsg}
        </div>
      )}

      {/* Asymmetric RSA Identity Card */}
      <div className="rounded-2xl border border-dark-600/70 bg-dark-800/60 p-6 backdrop-blur-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <h2 className="text-base font-bold text-white">Asymmetric User Identity (RSA-2048)</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Your public key is published to peers for wrapping unique AES session keys with RSA-OAEP.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopyRsa}
              className="rounded-xl border border-dark-500 bg-dark-700 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-dark-600 transition-colors"
            >
              {copied ? "Copied!" : "Copy Public Key PEM"}
            </button>
            <button
              onClick={handleRegenerateRsa}
              className="rounded-xl border border-accent-500/30 bg-accent-500/15 px-3.5 py-2 text-xs font-semibold text-accent-300 hover:bg-accent-500/25 transition-colors"
            >
              Regenerate Keypair
            </button>
          </div>
        </div>

        {rsaInfo?.public_key_pem && (
          <div className="mt-4 overflow-hidden rounded-xl bg-dark-900/80 p-3.5">
            <pre className="overflow-x-auto text-[11px] font-mono leading-relaxed text-slate-400 select-all">
              {rsaInfo.public_key_pem.trim()}
            </pre>
          </div>
        )}
      </div>

      {/* Symmetric Session Keys Table */}
      <div className="rounded-2xl border border-dark-600/70 bg-dark-800/60 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between pb-4 border-b border-dark-700">
          <div>
            <h2 className="text-base font-bold text-white">Session Keys Lifecycle Register</h2>
            <p className="text-xs text-slate-400">All symmetric session keys bound to your files</p>
          </div>
          <button
            onClick={loadData}
            className="text-xs font-medium text-accent-400 hover:text-accent-300"
          >
            Refresh Register
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading session keys...</div>
        ) : keys.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No session keys found.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-dark-700 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Key ID</th>
                  <th className="py-2.5 px-3">File / Transfer</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Algorithm</th>
                  <th className="py-2.5 px-3">Rotations</th>
                  <th className="py-2.5 px-3">Expires At</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50 text-slate-300">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-dark-700/30 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-400">#{k.id}</td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-white">{k.original_filename}</div>
                      <div className="text-[10px] text-slate-500">Transfer #{k.transfer_id}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          k.status === "ACTIVE"
                            ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                            : k.status === "ROTATED"
                            ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30"
                            : k.status === "EXPIRED"
                            ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
                            : "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {k.status}
                      </span>
                      {k.invalidation_reason && (
                        <div className="text-[10px] text-red-400/80 mt-0.5 max-w-[200px] truncate" title={k.invalidation_reason}>
                          {k.invalidation_reason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                      {k.algorithm} ({k.key_size_bits}-bit)
                    </td>
                    <td className="py-3 px-3 font-mono">{k.rotation_count}</td>
                    <td className="py-3 px-3 text-[11px] text-slate-400">
                      <div>{formatLocalDateTime(k.expires_at)}</div>
                      <div className="text-[10px] text-cyan-400 font-mono">{formatExpiry(k.expires_at)}</div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {k.status === "ACTIVE" && (
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleRotate(k.transfer_id)}
                            className="rounded-lg bg-dark-700 px-2 py-1 text-[11px] font-medium text-cyan-300 hover:bg-dark-600"
                          >
                            Rotate
                          </button>
                          <button
                            onClick={() => handleInvalidate(k.transfer_id)}
                            className="rounded-lg bg-red-500/15 px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/25"
                          >
                            Revoke
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default KeyManagementView;
