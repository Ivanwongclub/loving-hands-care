import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** null = still loading; true = family portal user; false = staff/other */
  isFamilyPortalUser: boolean | null;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithMagicLink: (email: string, redirectTo: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFamilyPortalUser, setIsFamilyPortalUser] = useState<boolean | null>(null);

  useEffect(() => {
    // 1) Subscribe FIRST to avoid losing the SIGNED_IN event.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    // 2) Then hydrate from existing session.
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Resolve family portal status whenever session changes
  useEffect(() => {
    if (!session) {
      setIsFamilyPortalUser(null);
      return;
    }
    let cancelled = false;
    setIsFamilyPortalUser(null);
    void supabase.rpc("is_family_portal_user").then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[auth] is_family_portal_user check failed:", error.message);
        setIsFamilyPortalUser(false);
      } else {
        setIsFamilyPortalUser(data === true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    loading,
    isFamilyPortalUser,
    signInWithPassword: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signInWithMagicLink: async (email, redirectTo) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  }), [session, loading, isFamilyPortalUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
