import { useState, useEffect, type FC } from "react";
import type {
  BenchmarkItem,
  AdaptiveComparison,
  AttackSimulationResponse,
} from "../lib/types";
import {
  apiRunBenchmarks,
  apiCompareApproaches,
  apiSimulateAttack,
  parseErrorMessage,
} from "../lib/api";

export const ExperimentsLabView: FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<"benchmarks" | "attacks">("benchmarks");

  // Benchmarks state
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkItem[]>([]);
  const [comparison, setComparison] = useState<AdaptiveComparison | null>(null);
  const [fileSizeKb, setFileSizeKb] = useState<number>(1024);
  const [runningBenchmark, setRunningBenchmark] = useState<boolean>(false);

  // Attack simulations state
  const [simulationResult, setSimulationResult] = useState<AttackSimulationResponse | null>(null);
  const [simulatingType, setSimulatingType] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load initial comparison and standard 1MB benchmark
    apiCompareApproaches()
      .then(setComparison)
      .catch((err) => setError(parseErrorMessage(err)));

    handleRunBenchmarks(1024);
  }, []);

  const handleRunBenchmarks = async (sizeKb: number) => {
    setRunningBenchmark(true);
    setError(null);
    try {
      const results = await apiRunBenchmarks(sizeKb, 3);
      setBenchmarkResults(results);
    } catch (err) {
      setError(parseErrorMessage(err));
    } finally {
      setRunningBenchmark(false);
    }
  };

  const handleRunSimulation = async (
    type: "tampering" | "expired_key" | "invalid_key" | "brute_force"
  ) => {
    setSimulatingType(type);
    setError(null);
    setSimulationResult(null);
    try {
      const res = await apiSimulateAttack(type);
      setSimulationResult(res);
    } catch (err) {
      setError(parseErrorMessage(err));
    } finally {
      setSimulatingType(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Research &amp; Validation Lab</h1>
        <p className="text-sm text-slate-400">
          Empirical evaluation comparing AES vs ChaCha20, Fixed vs Adaptive Key Management, and controlled attack simulations proving 100% integrity protection.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex border-b border-dark-700">
        <button
          onClick={() => setActiveSubTab("benchmarks")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeSubTab === "benchmarks"
              ? "border-accent-500 text-accent-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Performance Benchmarking &amp; Comparison
        </button>
        <button
          onClick={() => setActiveSubTab("attacks")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeSubTab === "attacks"
              ? "border-red-500 text-red-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Controlled Attack Simulations
        </button>
      </div>

      {/* Tab 1: Benchmarks */}
      {activeSubTab === "benchmarks" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-dark-600/70 bg-dark-800/60 p-5 backdrop-blur-sm sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-300">Payload Size:</span>
              <div className="flex gap-2">
                {[
                  { label: "100 KB", size: 100 },
                  { label: "1 MB", size: 1024 },
                  { label: "10 MB", size: 10240 },
                ].map((item) => (
                  <button
                    key={item.size}
                    onClick={() => {
                      setFileSizeKb(item.size);
                      handleRunBenchmarks(item.size);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      fileSizeKb === item.size
                        ? "bg-accent-500 text-white shadow-sm shadow-accent-500/30"
                        : "border border-dark-600 bg-dark-700/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleRunBenchmarks(fileSizeKb)}
              disabled={runningBenchmark}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-accent-500/20 hover:brightness-110 disabled:opacity-50"
            >
              {runningBenchmark ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Benchmarking in progress...
                </>
              ) : (
                "Run Live Performance Test"
              )}
            </button>
          </div>

          {/* Cipher Comparison Cards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {benchmarkResults.map((b) => (
              <div
                key={b.algorithm}
                className="rounded-2xl border border-dark-600/70 bg-dark-800/60 p-5 backdrop-blur-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{b.algorithm}</span>
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    100% SHA-256
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-dark-700/50 pb-1.5">
                    <span className="text-slate-400">Throughput:</span>
                    <span className="font-bold text-cyan-400">{b.throughput_mb_s} MB/s</span>
                  </div>
                  <div className="flex justify-between border-b border-dark-700/50 pb-1.5">
                    <span className="text-slate-400">Encryption Time:</span>
                    <span className="font-mono text-slate-200">{b.encryption_time_ms} ms</span>
                  </div>
                  <div className="flex justify-between border-b border-dark-700/50 pb-1.5">
                    <span className="text-slate-400">Decryption Time:</span>
                    <span className="font-mono text-slate-200">{b.decryption_time_ms} ms</span>
                  </div>
                  <div className="flex justify-between border-b border-dark-700/50 pb-1.5">
                    <span className="text-slate-400">Key Gen Time:</span>
                    <span className="font-mono text-slate-200">{b.key_generation_time_ms} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Peak Memory:</span>
                    <span className="font-mono text-slate-200">{b.memory_peak_kb} KB</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Fixed vs Adaptive Key Management Comparison Matrix */}
          {comparison && (
            <div className="rounded-2xl border border-dark-600/70 bg-dark-800/60 p-6 backdrop-blur-sm space-y-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center border-b border-dark-700 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white">Comparative Framework Evaluation</h2>
                  <p className="text-xs text-slate-400">Fixed Static Key Policy vs Proposed Adaptive Cryptographic Architecture</p>
                </div>
                <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                  {comparison.efficiency_gain_pct}% Exposure Window Reduction
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Fixed Approach */}
                <div className="rounded-xl border border-dark-600 bg-dark-900/60 p-4 space-y-2.5 text-xs">
                  <div className="font-bold text-slate-400 text-sm">
                    {comparison.fixed_approach.model_name || "Conventional Fixed Key Management"}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cipher Choice:</span>
                    <span className="text-slate-300">{comparison.fixed_approach.cipher}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Key Validity TTL:</span>
                    <span className="text-amber-400">{comparison.fixed_approach.key_validity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Key Rotation:</span>
                    <span className="text-slate-300">{comparison.fixed_approach.rotation_policy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Incident Adaptation:</span>
                    <span className="text-slate-300">{comparison.fixed_approach.threat_adaptation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Management Overhead:</span>
                    <span className="font-mono text-slate-300">{comparison.fixed_approach.key_management_overhead_ms} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Security Posture:</span>
                    <span className="text-red-400 font-bold">{comparison.fixed_approach.vulnerability_window_rating}</span>
                  </div>
                </div>

                {/* Adaptive Approach */}
                <div className="rounded-xl border border-accent-500/40 bg-accent-500/5 p-4 space-y-2.5 text-xs">
                  <div className="font-bold text-accent-300 text-sm">
                    {comparison.adaptive_approach.model_name || "Proposed Adaptive Key Management"}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cipher Choice:</span>
                    <span className="text-slate-200">{comparison.adaptive_approach.cipher}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Key Validity TTL:</span>
                    <span className="text-emerald-400 font-semibold">{comparison.adaptive_approach.key_validity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Key Rotation:</span>
                    <span className="text-slate-200">{comparison.adaptive_approach.rotation_policy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Incident Adaptation:</span>
                    <span className="text-cyan-300">{comparison.adaptive_approach.threat_adaptation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Management Overhead:</span>
                    <span className="font-mono text-slate-200">{comparison.adaptive_approach.key_management_overhead_ms} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Security Posture:</span>
                    <span className="text-emerald-400 font-bold">{comparison.adaptive_approach.vulnerability_window_rating}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-dark-900/60 p-3.5 text-xs text-slate-300 leading-relaxed">
                <span className="font-bold text-cyan-300">Empirical Conclusion: </span>
                {comparison.security_advantage}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Attack Simulations */}
      {activeSubTab === "attacks" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-dark-600/70 bg-dark-800/60 p-6 backdrop-blur-sm space-y-4">
            <h2 className="text-base font-bold text-white">Controlled Attack Simulation Suite</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Execute live security attack scenarios against CipherShare to observe real-time detection, SHA-256 integrity failure mitigation, and automated key invalidation in action.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Simulation 1: Tampering */}
              <div className="rounded-xl border border-dark-600 bg-dark-900/70 p-4 space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                    <h3 className="font-bold text-white text-sm">1. Tampering &amp; Bit Corruption Attack</h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Flips bits in the ciphertext during transmission to simulate man-in-the-middle packet tampering. Proves that AEAD tag and SHA-256 integrity verification catch modification 100% of the time.
                  </p>
                </div>
                <button
                  onClick={() => handleRunSimulation("tampering")}
                  disabled={simulatingType !== null}
                  className="rounded-lg bg-red-500/20 border border-red-500/30 px-3.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                >
                  {simulatingType === "tampering" ? "Simulating Attack..." : "Launch Tampering Test"}
                </button>
              </div>

              {/* Simulation 2: Expired Key */}
              <div className="rounded-xl border border-dark-600 bg-dark-900/70 p-4 space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <h3 className="font-bold text-white text-sm">2. Expired Key Access Attack</h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Attempts to decrypt a file after the adaptive validity TTL has passed. Proves zero-trust temporal key enforcement and automatic session revocation.
                  </p>
                </div>
                <button
                  onClick={() => handleRunSimulation("expired_key")}
                  disabled={simulatingType !== null}
                  className="rounded-lg bg-amber-500/20 border border-amber-500/30 px-3.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 disabled:opacity-50"
                >
                  {simulatingType === "expired_key" ? "Simulating Attack..." : "Launch Expired Key Test"}
                </button>
              </div>

              {/* Simulation 3: Rogue Key */}
              <div className="rounded-xl border border-dark-600 bg-dark-900/70 p-4 space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    <h3 className="font-bold text-white text-sm">3. Rogue Key Substitution Attack</h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Attempts decryption with an unauthorized or mismatched RSA private key. Proves RSA-OAEP asymmetric key encapsulation isolation.
                  </p>
                </div>
                <button
                  onClick={() => handleRunSimulation("invalid_key")}
                  disabled={simulatingType !== null}
                  className="rounded-lg bg-cyan-500/20 border border-cyan-500/30 px-3.5 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50"
                >
                  {simulatingType === "invalid_key" ? "Simulating Attack..." : "Launch Rogue Key Test"}
                </button>
              </div>

              {/* Simulation 4: Brute Force */}
              <div className="rounded-xl border border-dark-600 bg-dark-900/70 p-4 space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-400" />
                    <h3 className="font-bold text-white text-sm">4. Brute Force Threat Escalation</h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Triggers rapid unauthorized anomaly events. Demonstrates the Adaptive Security Policy feedback loop contracting session TTL by 50% and enforcing strict single-use keys.
                  </p>
                </div>
                <button
                  onClick={() => handleRunSimulation("brute_force")}
                  disabled={simulatingType !== null}
                  className="rounded-lg bg-purple-500/20 border border-purple-500/30 px-3.5 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/30 disabled:opacity-50"
                >
                  {simulatingType === "brute_force" ? "Simulating Attack..." : "Launch Anomaly Escalation"}
                </button>
              </div>
            </div>
          </div>

          {/* Simulation Output Card */}
          {simulationResult && (
            <div className="rounded-2xl border border-dark-600/70 bg-dark-900 p-6 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-dark-700 pb-2">
                <span className="font-bold text-white uppercase">
                  Simulation Forensic Report: {simulationResult.simulation_type}
                </span>
                <span
                  className={`rounded px-2.5 py-0.5 font-bold ${
                    simulationResult.attack_detected
                      ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                      : "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                  }`}
                >
                  {simulationResult.status}
                </span>
              </div>

              <div className="space-y-1.5 text-slate-300">
                <div>
                  <span className="text-slate-500">Security Outcome: </span>
                  <span className="text-white font-semibold">{simulationResult.message}</span>
                </div>
                <div>
                  <span className="text-slate-500">Event Logged to Audit: </span>
                  <span className="text-cyan-400">{simulationResult.event_logged}</span>
                </div>
                <div>
                  <span className="text-slate-500">Mitigation Action: </span>
                  <span className="text-amber-300">{simulationResult.mitigation_action}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-dark-800">
                <div className="text-[11px] text-slate-500 uppercase">Telemetry Details:</div>
                <pre className="mt-1 text-[11px] text-slate-400 bg-dark-800/60 p-2.5 rounded overflow-x-auto">
                  {JSON.stringify(simulationResult.details, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default ExperimentsLabView;
