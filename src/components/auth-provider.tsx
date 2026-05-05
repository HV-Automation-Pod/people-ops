"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";
import { LoadingScreen } from "@/components/ui/loading-screen";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  accessList: string[];
  pendingRequests: string[];
  isAdmin: boolean;
  loading: boolean;
  hasAccess: (automationId: string) => boolean;
  logout: () => Promise<void>;
  requestAccess: (automationId: string) => Promise<boolean>;
  /** Fetch with Authorization header auto-attached */
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  /** Re-fetch user profile + access (call after access changes) */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PATHS = ["/login", "/auth/callback"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [accessList, setAccessList] = useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // Guard against re-fetching profile when Supabase fires SIGNED_IN again on
  // tab focus. Once we have a profile for this session, we don't fetch again.
  const profileLoadedRef = useRef(false);

  const isPublic = PUBLIC_PATHS.includes(pathname);

  const fetchProfile = useCallback(async (accessToken: string) => {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return res.json();
  }, []);

  // Check session on mount and auth state changes
  useEffect(() => {
    const supabase = createBrowserClient();

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        if (!isPublic) router.replace("/login");
        return;
      }

      setToken(session.access_token);

      const profile = await fetchProfile(session.access_token);
      if (!profile) {
        setLoading(false);
        if (!isPublic) router.replace("/login");
        return;
      }

      setUser(profile.user);
      setAccessList(profile.accessList ?? []);
      setPendingRequests(profile.pendingRequests ?? []);
      profileLoadedRef.current = true;
      setLoading(false);
    };

    init();

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setToken(null);
        setAccessList([]);
        setPendingRequests([]);
        profileLoadedRef.current = false;
        router.replace("/login");
        return;
      }

      // TOKEN_REFRESHED fires every time the tab regains focus. We only
      // need the fresh access_token — the profile doesn't change. Re-fetching
      // it here creates a new `user` object reference and cascades loading
      // flashes into every page that depends on [user].
      if (event === "TOKEN_REFRESHED") {
        setToken(session.access_token);
        return;
      }

      if (event === "SIGNED_IN") {
        setToken(session.access_token);
        // Skip re-fetch if profile is already loaded (e.g., init() got it
        // first, or Supabase re-fires SIGNED_IN on tab focus).
        if (profileLoadedRef.current) return;
        const profile = await fetchProfile(session.access_token);
        if (profile) {
          setUser(profile.user);
          setAccessList(profile.accessList ?? []);
          setPendingRequests(profile.pendingRequests ?? []);
          profileLoadedRef.current = true;
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isAdmin = user?.role === "admin";

  const hasAccess = useCallback(
    (automationId: string) => {
      return isAdmin || accessList.includes(automationId);
    },
    [isAdmin, accessList]
  );

  const logout = useCallback(async () => {
    await createBrowserClient().auth.signOut();
    // onAuthStateChange handles the redirect
  }, []);

  // IMPORTANT: deliberately no `token` dependency. authFetch reads the
  // current session fresh from Supabase on every call, so the closure
  // never needs the in-state token value. Keeping this reference stable
  // prevents cascades of re-renders / re-fetches in downstream useEffects
  // (e.g. Profile page, Admin page) whenever Supabase rotates the token
  // on tab focus — which was causing a loading flash on every tab return.
  const authFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const supabase = createBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentToken = session?.access_token;

      return fetch(url, {
        ...init,
        headers: {
          ...init?.headers,
          ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        },
      });
    },
    []
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    const profile = await fetchProfile(token);
    if (profile) {
      setUser(profile.user);
      setAccessList(profile.accessList ?? []);
      setPendingRequests(profile.pendingRequests ?? []);
    }
  }, [token, fetchProfile]);

  const requestAccess = useCallback(
    async (automationId: string) => {
      const res = await authFetch("/api/access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automation_id: automationId }),
      });
      if (res.ok) {
        setPendingRequests((p) => [...p, automationId]);
        return true;
      }
      return false;
    },
    [authFetch]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      accessList,
      pendingRequests,
      isAdmin,
      loading,
      hasAccess,
      logout,
      requestAccess,
      authFetch,
      refresh,
    }),
    [
      user,
      token,
      accessList,
      pendingRequests,
      isAdmin,
      loading,
      hasAccess,
      logout,
      requestAccess,
      authFetch,
      refresh,
    ]
  );

  // Public pages render immediately
  if (isPublic) {
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }

  // Protected pages show loading screen until auth resolves
  if (loading) {
    return (
      <AuthContext.Provider value={value}>
        <LoadingScreen message="Authenticating..." />
      </AuthContext.Provider>
    );
  }

  // No user on a protected page — redirect already triggered, show nothing
  if (!user) {
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
