import { useState, useEffect, useCallback } from "react";
import LandingPage from "./components/LandingPage";
import AuthPage from "./components/AuthPage";
import Navbar, { type ActiveTab } from "./components/Navbar";
import DashboardOverview from "./components/DashboardOverview";
import SendFileView from "./components/SendFileView";
import InboxView from "./components/InboxView";
import SentView from "./components/SentView";
import KeyManagementView from "./components/KeyManagementView";
import SecurityAuditView from "./components/SecurityAuditView";
import ExperimentsLabView from "./components/ExperimentsLabView";

import type {
  HealthStatus,
  UserResponse,
  FileTransfer,
  AuditSummary,
} from "./lib/types";
import {
  apiHealthCheck,
  apiGetMe,
  apiGetInbox,
  apiGetSent,
  apiGetSecuritySummary,
  getToken,
  clearToken,
} from "./lib/api";
import { parseUtcDate } from "./lib/dateUtils";

type Page = "landing" | "auth" | "app";

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [user, setUser] = useState<UserResponse | null>(null);
  const [page, setPage] = useState<Page>("landing");
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [initialising, setInitialising] = useState(true);

  // Application Data
  const [inboxTransfers, setInboxTransfers] = useState<FileTransfer[]>([]);
  const [sentTransfers, setSentTransfers] = useState<FileTransfer[]>([]);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);

  // Fetch health status on mount
  useEffect(() => {
    apiHealthCheck()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const loadUserData = useCallback(() => {
    if (!getToken()) return;
    Promise.all([
      apiGetInbox().catch(() => []),
      apiGetSent().catch(() => []),
      apiGetSecuritySummary().catch(() => null),
    ]).then(([inbox, sent, summary]) => {
      setInboxTransfers(inbox);
      setSentTransfers(sent);
      setAuditSummary(summary);
    });
  }, []);

  // On mount, validate any existing token
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setInitialising(false);
      return;
    }
    apiGetMe()
      .then((u) => {
        setUser(u);
        setPage("app");
        setInitialising(false);
        loadUserData();
      })
      .catch(() => {
        clearToken();
        setInitialising(false);
      });
  }, [loadUserData]);

  const handleAuthSuccess = (u: UserResponse, _token: string) => {
    setUser(u);
    setPage("app");
    setActiveTab("overview");
    loadUserData();
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setPage("landing");
  };

  // Don't flash the wrong page while validating stored token
  if (initialising) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-900">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="h-5 w-5 animate-spin text-accent-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">Initializing CipherShare...</span>
        </div>
      </div>
    );
  }

  // Auth screen
  if (page === "auth") {
    return (
      <AuthPage
        onAuthSuccess={handleAuthSuccess}
        onBack={() => setPage(user ? "app" : "landing")}
      />
    );
  }

  // Unauthenticated Landing Page
  if (page === "landing" || !user) {
    return (
      <LandingPage
        health={health}
        user={user}
        onNavigateAuth={() => setPage("auth")}
        onLogout={handleLogout}
      />
    );
  }

  // Authenticated Secure Dashboard
  const allTransfers = [...inboxTransfers, ...sentTransfers].sort((a, b) => {
    const timeA = parseUtcDate(a.created_at)?.getTime() || 0;
    const timeB = parseUtcDate(b.created_at)?.getTime() || 0;
    return timeB - timeA;
  });

  return (
    <div className="min-h-screen bg-dark-900 text-slate-200">
      <Navbar
        health={health}
        user={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
        inboxCount={inboxTransfers.filter((t) => t.status === "ACTIVE").length}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === "overview" && (
          <DashboardOverview
            user={user}
            transfers={allTransfers}
            auditSummary={auditSummary}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === "send" && (
          <SendFileView
            onTransferSuccess={() => {
              loadUserData();
              setActiveTab("sent");
            }}
          />
        )}

        {activeTab === "inbox" && (
          <InboxView
            transfers={inboxTransfers}
            onRefresh={loadUserData}
          />
        )}

        {activeTab === "sent" && (
          <SentView
            transfers={sentTransfers}
            onRefresh={loadUserData}
          />
        )}

        {activeTab === "keys" && (
          <KeyManagementView />
        )}

        {activeTab === "security" && (
          <SecurityAuditView />
        )}

        {activeTab === "experiments" && (
          <ExperimentsLabView />
        )}
      </main>
    </div>
  );
}

export default App;
