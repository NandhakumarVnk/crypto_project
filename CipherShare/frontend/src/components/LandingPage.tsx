import type { FC } from "react";
import type { HealthStatus, UserResponse } from "../lib/types";

interface LandingPageProps {
  health: HealthStatus | null;
  user: UserResponse | null;
  onNavigateAuth: () => void;
  onLogout: () => void;
}

const LandingPage: FC<LandingPageProps> = ({ health, user, onNavigateAuth, onLogout }) => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-dark-900">
      {/* Animated background gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-96 w-96 animate-pulse rounded-full bg-accent-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-80 w-80 animate-pulse rounded-full bg-cyan-500/15 blur-3xl [animation-delay:1s]" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 animate-pulse rounded-full bg-emerald-500/10 blur-3xl [animation-delay:2s]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-cyan-500 font-bold text-white shadow-lg shadow-accent-500/25">
            CS
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            CipherShare
          </span>
        </div>
        <div className="flex items-center gap-4">
          {health && (
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              API {health.status} · v{health.version}
            </div>
          )}
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-4 py-1.5 text-sm text-accent-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {user.email}
              </div>
              <button
                onClick={onLogout}
                className="rounded-full border border-dark-500/60 bg-dark-700/60 px-4 py-1.5 text-sm text-slate-400 transition-all duration-200 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={onNavigateAuth}
              className="rounded-full bg-gradient-to-r from-accent-500 to-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-accent-500/30 hover:brightness-110"
            >
              Get Started
            </button>
          )}
        </div>
      </nav>

      {/* Hero section */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-24 text-center sm:pt-32 lg:pt-40">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-4 py-1.5 text-sm font-medium text-accent-400">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          Cryptography &amp; Network Security Project
        </div>

        <h1 className="max-w-4xl text-5xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
          Secure file sharing with{" "}
          <span className="bg-gradient-to-r from-accent-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            adaptive encryption
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
          End-to-end encrypted transfers between two users, powered by adaptive
          cryptographic key management, integrity verification, and real-time
          security monitoring.
        </p>

        {/* CTA for unauthenticated users */}
        {!user && (
          <div className="mt-10">
            <button
              onClick={onNavigateAuth}
              className="rounded-xl bg-gradient-to-r from-accent-500 to-cyan-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-accent-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-accent-500/30 hover:brightness-110"
            >
              Get Started — Create Account
            </button>
          </div>
        )}

        {/* Feature cards */}
        <div className="mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            title="Adaptive Key Management"
            description="Dynamically selects cryptographic algorithms based on file characteristics and threat context."
          />
          <FeatureCard
            title="Integrity Verification"
            description="SHA-256 hash verification ensures files arrive unmodified from sender to recipient."
          />
          <FeatureCard
            title="Security Monitoring"
            description="Real-time logging of cryptographic operations with anomaly detection alerts."
          />
          <FeatureCard
            title="Performance Benchmarks"
            description="Comparative analysis of AES-128, AES-256, and ChaCha20 across file sizes."
          />
          <FeatureCard
            title="Attack Simulations"
            description="Controlled brute-force and tampering tests to validate system resilience."
          />
          <FeatureCard
            title="Two-User Architecture"
            description="Purpose-built for secure peer sharing with mutual authentication."
          />
        </div>

        {/* Status footer */}
        <div className="mt-20 mb-12 text-sm text-slate-500">
          {health ? (
            <span>
              Backend connected — {health.status} · v{health.version}
            </span>
          ) : (
            <span className="text-amber-400/80">
              Backend not connected — start the FastAPI server to see status
            </span>
          )}
        </div>
      </main>
    </div>
  );
};

interface FeatureCardProps {
  title: string;
  description: string;
}

const FeatureCard: FC<FeatureCardProps> = ({ title, description }) => (
  <div className="group rounded-2xl border border-dark-500/60 bg-dark-800/60 p-6 backdrop-blur-sm transition-all duration-300 hover:border-accent-500/40 hover:bg-dark-700/60 hover:shadow-lg hover:shadow-accent-500/5">
    <h3 className="mb-2 text-lg font-semibold text-white group-hover:text-accent-400 transition-colors duration-300">
      {title}
    </h3>
    <p className="text-sm leading-relaxed text-slate-400">{description}</p>
  </div>
);

export default LandingPage;
