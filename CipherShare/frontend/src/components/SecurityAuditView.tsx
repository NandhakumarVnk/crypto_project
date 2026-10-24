import { useState, useEffect, type FC } from "react";
import type { SecurityEvent, AuditSummary } from "../lib/types";
import {
  apiGetSecurityEvents,
  apiGetSecuritySummary,
  parseErrorMessage,
} from "../lib/api";
import { formatLocalTime } from "../lib/dateUtils";

export const SecurityAuditView: FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      apiGetSecurityEvents(100, severityFilter || undefined),
      apiGetSecuritySummary(),
    ])
      .then(([evList, summ]) => {
        setEvents(evList);
        setSummary(summ);
        setLoading(false);
      })
      .catch((err) => {
        setError(parseErrorMessage(err));
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [severityFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Security Monitoring &amp; Audit Trail</h1>
          <p className="text-sm text-slate-400">
            Real-time audit telemetry capturing file encryptions, key lifecycle transitions, SHA-256 integrity verifications, and anomaly triggers.
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-dark-600 bg-dark-800 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-dark-700 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Feed
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Summary Metrics */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-dark-600/70 bg-dark-800/60 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Audit Logs</span>
            <div className="mt-1 text-2xl font-extrabold text-white">{summary.total_events}</div>
          </div>
          <div className="rounded-2xl border border-dark-600/70 bg-dark-800/60 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Integrity Verified</span>
            <div className="mt-1 text-2xl font-extrabold text-emerald-400">{summary.integrity_verified}</div>
          </div>
          <div className="rounded-2xl border border-dark-600/70 bg-dark-800/60 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Key Rotations</span>
            <div className="mt-1 text-2xl font-extrabold text-cyan-400">{summary.key_rotations}</div>
          </div>
          <div className="rounded-2xl border border-dark-600/70 bg-dark-800/60 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Critical Anomaly Alarms</span>
            <div className="mt-1 text-2xl font-extrabold text-red-400">{summary.critical_events}</div>
          </div>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-dark-600/70 bg-dark-800/60 p-6 backdrop-blur-sm">
        <div className="flex flex-col justify-between gap-3 pb-4 border-b border-dark-700 sm:flex-row sm:items-center">
          <h2 className="text-base font-bold text-white">Event Log Feed</h2>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-lg border border-dark-500 bg-dark-900 px-2.5 py-1 text-xs text-slate-300 focus:outline-none"
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="WARNING">Warning Only</option>
              <option value="INFO">Info Only</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading audit events...</div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No security events match criteria.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-dark-700 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Mitigation Action</th>
                  <th className="py-2.5 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50 text-slate-300">
                {events.map((e) => {
                  const isExpanded = expandedId === e.id;
                  return (
                    <tr key={e.id} className="hover:bg-dark-700/30 transition-colors">
                      <td className="py-3 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                        {formatLocalTime(e.timestamp)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            e.severity === "CRITICAL"
                              ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30"
                              : e.severity === "WARNING"
                              ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30"
                              : "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30"
                          }`}
                        >
                          {e.severity}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-white">
                        {e.event_type}
                      </td>
                      <td className="py-3 px-3 max-w-sm truncate" title={e.description}>
                        {e.description}
                      </td>
                      <td className="py-3 px-3 text-slate-400 italic">
                        {e.mitigation_action || "Standard protocol logged"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {e.details ? (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : e.id)}
                            className="rounded bg-dark-700 px-2 py-0.5 text-[10px] text-accent-300 hover:bg-dark-600"
                          >
                            {isExpanded ? "Hide" : "Inspect"}
                          </button>
                        ) : (
                          <span className="text-slate-600">&mdash;</span>
                        )}
                        {isExpanded && e.details && (
                          <div className="mt-2 text-left bg-dark-900 p-2.5 rounded font-mono text-[10px] text-slate-300">
                            <pre>{JSON.stringify(e.details, null, 2)}</pre>
                          </div>
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
export default SecurityAuditView;
