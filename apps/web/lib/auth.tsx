/**
 * Frontend auth context — Supabase client setup, hooks, and protected route utilities.
 *
 * Architecture:
 *   - Supabase client is a singleton (browser-side only)
 *   - Auth state is managed via React Context
 *   - useAuth hook provides the current user + loading state
 *   - withAuth HOC / ProtectedRoute component blocks unauthenticated access
 *   - Role-based access: useRequireRole hook redirects if insufficient permissions
 *
 * Usage:
 *   // In your app root:
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 *
 *   // In components:
 *   const { user, session, signOut, isLoading } = useAuth();
 *
 *   // Protected pages (Next.js App Router):
 *   export default withAuth(MyPage);
 *   export default withAuth(MyPage, { requiredRole: 'brand_owner' });
 */

"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  createClient,
  type SupabaseClient,
  type User,
  type Session,
  type AuthChangeEvent,
} from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import type { UserRoleType, MeResponse } from "@loocbooc/types";

// ─── Supabase Client (singleton) ─────────────────────────────────────────────

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  supabaseInstance = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: "loocbooc-auth",
    },
  });

  return supabaseInstance;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  role: UserRoleType;
  fullName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface AuthContextValue {
  user: AuthUser | null;
  session: Session | null;
  profile: MeResponse | null;   // full /me response with brand/manufacturer associations
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, metadata?: { fullName?: string }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  supabase: SupabaseClient;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (accessToken: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${apiUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const json = (await res.json()) as { data: MeResponse };
        setProfile(json.data);
        return json.data;
      }
    } catch {
      // Profile fetch failure is non-fatal — auth still works
    }
    return null;
  }, []);

  const syncUser = useCallback(
    async (supabaseUser: User | null, currentSession: Session | null) => {
      if (!supabaseUser || !currentSession) {
        setUser(null);
        setSession(null);
        setProfile(null);
        return;
      }

      const appMeta = supabaseUser.app_metadata as { role?: UserRoleType } | undefined;

      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email ?? "",
        role: appMeta?.role ?? "consumer",
        fullName:
          (supabaseUser.user_metadata as { full_name?: string })?.full_name ??
          null,
        displayName: null,
        avatarUrl:
          (supabaseUser.user_metadata as { avatar_url?: string })?.avatar_url ??
          null,
      });
      setSession(currentSession);

      // Fetch full profile from our API
      await fetchProfile(currentSession.access_token);
    },
    [fetchProfile]
  );

  // Initialise auth state on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      await syncUser(data.session?.user ?? null, data.session ?? null);
      setIsLoading(false);
    };

    void init();

    // Listen for auth state changes (sign in, sign out, token refresh)
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        if (!mounted) return;

        if (event === "SIGNED_OUT") {
          setUser(null);
          setSession(null);
          setProfile(null);
        } else if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        ) {
          await syncUser(newSession?.user ?? null, newSession);
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase, syncUser]);

  // ── Auth methods ─────────────────────────────────────────────────────────────

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        // Return identical message regardless of actual error (enumeration prevention)
        return {
          error: "Sign in failed. Please check your email and password.",
        };
      }

      return { error: null };
    },
    [supabase]
  );

  const signInWithGoogle = useCallback(async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    return { error: error?.message ?? null };
  }, [supabase]);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata?: { fullName?: string }
    ): Promise<{ error: string | null }> => {
      // Password strength is enforced at the API level (/auth/register)
      // This method is for Supabase-native signup (used when not going through our API)
      const { error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: {
            full_name: metadata?.fullName ?? null,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { error: "Registration failed. Please try again." };
      }

      return { error: null };
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // User/session state cleared by onAuthStateChange SIGNED_OUT handler
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (session?.access_token) {
      await fetchProfile(session.access_token);
    }
  }, [session, fetchProfile]);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    refreshProfile,
    supabase,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── useAuth hook ─────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

// ─── useRequireAuth ───────────────────────────────────────────────────────────

/**
 * Redirects to /auth/sign-in if not authenticated.
 * Use in page components that require auth.
 */
export function useRequireAuth(redirectTo = "/auth/sign-in"): AuthContextValue {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      const returnUrl = encodeURIComponent(window.location.pathname);
      router.push(`${redirectTo}?returnUrl=${returnUrl}`);
    }
  }, [auth.isLoading, auth.isAuthenticated, router, redirectTo]);

  return auth;
}

// ─── useRequireRole ───────────────────────────────────────────────────────────

/**
 * Redirects to /unauthorized if the user doesn't have one of the required roles.
 * Must be used after useRequireAuth (or on routes already protected by requireAuth).
 */
export function useRequireRole(
  roles: UserRoleType[],
  redirectTo = "/unauthorized"
): AuthContextValue & { hasRole: boolean } {
  const auth = useAuth();
  const router = useRouter();

  const hasRole = !!auth.user && roles.includes(auth.user.role);

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated && !hasRole) {
      router.push(redirectTo);
    }
  }, [auth.isLoading, auth.isAuthenticated, hasRole, router, redirectTo]);

  return { ...auth, hasRole };
}

// ─── withAuth HOC ─────────────────────────────────────────────────────────────

export interface WithAuthOptions {
  /** If provided, user must have one of these roles to access the page. */
  requiredRole?: UserRoleType | UserRoleType[];
  /** Redirect destination if not authenticated. Default: /auth/sign-in */
  redirectIfUnauthenticated?: string;
  /** Redirect destination if authenticated but wrong role. Default: /unauthorized */
  redirectIfUnauthorized?: string;
}

/**
 * Higher-order component for protecting pages in Next.js App Router.
 *
 * Usage:
 *   export default withAuth(MyBrandPage, { requiredRole: 'brand_owner' });
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthOptions = {}
): React.FC<P> {
  const {
    requiredRole,
    redirectIfUnauthenticated = "/auth/sign-in",
    redirectIfUnauthorized = "/unauthorized",
  } = options;

  const requiredRoles = requiredRole
    ? Array.isArray(requiredRole)
      ? requiredRole
      : [requiredRole]
    : null;

  const WrappedComponent: React.FC<P> = (props) => {
    const auth = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (auth.isLoading) return;

      if (!auth.isAuthenticated) {
        const returnUrl = encodeURIComponent(window.location.pathname);
        router.push(`${redirectIfUnauthenticated}?returnUrl=${returnUrl}`);
        return;
      }

      if (requiredRoles && auth.user && !requiredRoles.includes(auth.user.role)) {
        router.push(redirectIfUnauthorized);
      }
    }, [auth.isLoading, auth.isAuthenticated, auth.user, router]);

    if (auth.isLoading) {
      // Return null during loading — layout should show a skeleton
      return null;
    }

    if (!auth.isAuthenticated) return null;

    if (requiredRoles && auth.user && !requiredRoles.includes(auth.user.role)) {
      return null;
    }

    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withAuth(${Component.displayName ?? Component.name ?? "Component"})`;

  return WrappedComponent;
}

// ─── ProtectedRoute component ─────────────────────────────────────────────────

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRoleType | UserRoleType[];
  fallback?: ReactNode;
  redirectTo?: string;
}

/**
 * Inline route protection for nested components.
 * Renders `fallback` (or null) while loading/unauthorized.
 *
 * Usage:
 *   <ProtectedRoute requiredRole="brand_owner">
 *     <BrandDashboard />
 *   </ProtectedRoute>
 */
export function ProtectedRoute({
  children,
  requiredRole,
  fallback = null,
  redirectTo,
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  const requiredRoles = requiredRole
    ? Array.isArray(requiredRole)
      ? requiredRole
      : [requiredRole]
    : null;

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && redirectTo) {
      router.push(redirectTo);
    }
  }, [isLoading, isAuthenticated, redirectTo, router]);

  if (isLoading) return <>{fallback}</>;
  if (!isAuthenticated) return <>{fallback}</>;
  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ─── Auth callback handler (for OAuth redirects) ──────────────────────────────

/**
 * Call this from your /auth/callback page to exchange the OAuth code for a session.
 * Next.js App Router: create app/auth/callback/page.tsx that calls this.
 */
export async function handleAuthCallback(): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(
    window.location.search
  );

  return { error: error?.message ?? null };
}
