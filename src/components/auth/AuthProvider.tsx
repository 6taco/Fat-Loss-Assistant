'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { clearActiveAccount, createCloudAccount } from '@/lib/accounts';
import { identifyAnalyticsUser } from '@/lib/analytics/client';

export interface AuthUserSummary {
  id: string;
  email: string;
  emailVerified: boolean;
  hasProfile: boolean;
  profileUserId: string | null;
}

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: AuthUserSummary };

type AuthContextValue = AuthState & {
  refresh: () => Promise<AuthState>;
  logout: (all?: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json() as { authenticated: boolean; user?: AuthUserSummary };
      if (data.authenticated && data.user) {
        createCloudAccount(data.user.id, data.user.email);
        identifyAnalyticsUser(data.user.profileUserId || data.user.id);
        const next: AuthState = { status: 'authenticated', user: data.user };
        setState(next);
        return next;
      }
    } catch {
      // Authentication state remains anonymous when the service is unavailable.
    }
    identifyAnalyticsUser(null);
    const next: AuthState = { status: 'anonymous', user: null };
    setState(next);
    return next;
  }, []);

  const logout = useCallback(async (all = false) => {
    await fetch(all ? '/api/auth/logout-all' : '/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    clearActiveAccount();
    identifyAnalyticsUser(null);
    setState({ status: 'anonymous', user: null });
    router.replace('/accounts');
  }, [router]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refresh(), 0);
    const onExpired = () => {
      setState({ status: 'anonymous', user: null });
      router.replace('/accounts?reason=session_expired');
    };
    window.addEventListener('auth-expired', onExpired);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener('auth-expired', onExpired);
    };
  }, [refresh, router]);

  const value = useMemo(() => ({ ...state, refresh, logout }), [state, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
