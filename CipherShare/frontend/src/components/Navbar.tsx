import type { FC } from "react";
import type { HealthStatus, UserResponse } from "../lib/types";

export type ActiveTab =
  | "overview"
  | "send"
  | "inbox"
  | "sent"
  | "keys"
  | "security"
  | "experiments";

interface NavbarProps {
  health: HealthStatus | null;
  user: UserResponse;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onLogout: () => void;
  inboxCount: number;
}

export const Navbar: FC<NavbarProps> = ({
  health,
  user,
  activeTab,
  onTabChange,
  onLogout,
  inboxCount,
}) => {
  const navItems: { id: ActiveTab; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "send", label: "Send & Encrypt" },
    { id: "inbox", label: "Inbox", badge: inboxCount },
    { id: "sent", label: "Sent Transfers" },
    { id: "keys", label: "Key Lifecycle" },
    { id: "security", label: "Security & Audit" },
    { id: "experiments", label: "Research Lab" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-dark-600/80 bg-dark-900/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => onTabChange("overview")}
            className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-90"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-accent-600 via-accent-500 to-cyan-400 font-extrabold text-white shadow-lg shadow-accent-500/25 ring-1 ring-white/20">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white">CipherShare</span>
                <span className="rounded bg-accent-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-300 ring-1 ring-accent-500/40">
                  Adaptive
                </span>
              </div>
              <p className="hidden text-xs text-slate-400 sm:block">Zero-Trust Cryptographic File Transfer</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-accent-500/15 text-accent-300 shadow-sm ring-1 ring-accent-500/30"
                      : "text-slate-400 hover:bg-dark-700/60 hover:text-slate-200"
                  }`}
                >
                  {item.label}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-bold text-dark-900">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Section: Status, User, Logout */}
        <div className="flex items-center gap-3">
          {health && (
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span>v{health.version}</span>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-full border border-dark-600 bg-dark-800/80 px-3 py-1 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full bg-accent-400" />
            <span className="max-w-[140px] truncate font-medium sm:max-w-[200px]">{user.email}</span>
            <span className="rounded bg-cyan-500/20 px-1 text-[10px] text-cyan-300">RSA-2048</span>
          </div>

          <button
            onClick={onLogout}
            title="Sign Out"
            className="rounded-lg border border-dark-600 bg-dark-800 p-2 text-slate-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="flex overflow-x-auto border-t border-dark-700/60 px-4 py-2 lg:hidden">
        <div className="flex gap-1.5">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                  active
                    ? "bg-accent-500/20 text-accent-300 ring-1 ring-accent-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {item.label}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-cyan-500 px-1 text-[9px] font-bold text-dark-900">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
export default Navbar;
