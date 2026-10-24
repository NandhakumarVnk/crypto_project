import { useState, type FC, type FormEvent } from "react";
import type { UserResponse } from "../lib/types";
import {
  apiRegister,
  apiLogin,
  apiGetMe,
  setToken,
  parseErrorMessage,
} from "../lib/api";

interface AuthPageProps {
  onAuthSuccess: (user: UserResponse, token: string) => void;
  onBack: () => void;
}

const AuthPage: FC<AuthPageProps> = ({ onAuthSuccess, onBack }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return; // prevent duplicate submissions

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isLogin) {
        const tokenResp = await apiLogin(email, password);
        setToken(tokenResp.access_token);
        // Fetch user profile after login
        const user = await apiGetMe();
        onAuthSuccess(user, tokenResp.access_token);
      } else {
        await apiRegister(email, password);
        setSuccess("Account created! Logging you in…");
        // Auto-login after registration
        const tokenResp = await apiLogin(email, password);
        setToken(tokenResp.access_token);
        const user = await apiGetMe();
        onAuthSuccess(user, tokenResp.access_token);
      }
    } catch (err) {
      setError(parseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

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
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 transition-colors duration-200 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-sm font-medium">Back to Home</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-cyan-500 font-bold text-white shadow-lg shadow-accent-500/25">
            CS
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            CipherShare
          </span>
        </div>
      </nav>

      {/* Auth form */}
      <main className="relative z-10 flex min-h-[calc(100vh-88px)] items-center justify-center px-6">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="rounded-2xl border border-dark-500/60 bg-dark-800/80 p-8 shadow-2xl backdrop-blur-sm">
            {/* Header */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-cyan-500 shadow-lg shadow-accent-500/25">
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white">
                {isLogin ? "Welcome Back" : "Create Account"}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {isLogin
                  ? "Sign in to access your secure workspace"
                  : "Join CipherShare for secure file sharing"}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium text-slate-300">
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-dark-500/60 bg-dark-700/60 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-accent-500/60 focus:ring-2 focus:ring-accent-500/20"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isLogin ? "Enter your password" : "Min. 12 characters"}
                    className="w-full rounded-xl border border-dark-500/60 bg-dark-700/60 px-4 py-3 pr-12 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-accent-500/60 focus:ring-2 focus:ring-accent-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-white"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
                {!isLogin && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Must be at least 12 characters long.
                  </p>
                )}
              </div>

              {/* Error / Success messages */}
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                  {success}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-accent-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-accent-500/30 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {isLogin ? "Signing in…" : "Creating account…"}
                  </span>
                ) : isLogin ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            {/* Switch mode */}
            <div className="mt-6 text-center text-sm text-slate-400">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={switchMode}
                className="font-medium text-accent-400 transition-colors hover:text-accent-300"
              >
                {isLogin ? "Sign Up" : "Sign In"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuthPage;
