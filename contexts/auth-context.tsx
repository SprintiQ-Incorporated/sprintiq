"use client";

import type React from "react";

import { createClientSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { signInAction, signOutAction } from "@/lib/auth-actions";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (
    email: string,
    password: string,
    mcpToken?: string,
    redirectUrl?: string
  ) => Promise<{
    error: any | null;
    data: any | null;
  }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClientSupabaseClient();

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Skip redundant updates when token refresh fails to prevent cascading re-renders
      if (event === "TOKEN_REFRESHED" && !session) return;
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signIn = async (
    email: string,
    password: string,
    mcpToken?: string,
    redirectUrl?: string
  ) => {
    const result = await signInAction(email, password);

    if (result && !result.error && result.user) {
      // Handle MCP token flow — mark completed before redirecting to CLI
      if (mcpToken && redirectUrl) {
        await fetch("/api/mcp/auth/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: mcpToken, email }),
        });
        const mcpCallbackUrl = new URL(redirectUrl);
        mcpCallbackUrl.searchParams.set("mcp_token", mcpToken);
        mcpCallbackUrl.searchParams.set("email", email);
        window.location.href = mcpCallbackUrl.toString();
        return { error: null, data: result.user };
      }

      // Look up user's owned workspace
      const { data: workspaces } = await supabase
        .from("workspaces")
        .select("workspace_id")
        .eq("owner_id", result.user.id)
        .is("deleted_at", null)
        .limit(1);

      if (workspaces && workspaces.length > 0) {
        router.push(`/${workspaces[0].workspace_id}/home`);
      } else {
        router.push("/setup-workspace");
      }
    }

    if (result) {
      if (result.error) {
        return { error: result.error, data: null };
      } else if (result.user) {
        return { error: null, data: result.user };
      }
    }
    return { error: "An unexpected error occurred", data: null };
  };

  const signOut = async () => {
    await signOutAction();
    router.push("/");
  };

  const handleInactivityTimeout = useCallback(async () => {
    await signOutAction();
    router.push("/signin?reason=inactivity");
  }, [router]);

  useInactivityTimeout({
    onTimeout: handleInactivityTimeout,
    isEnabled: !!session,
  });

  const value = {
    user,
    session,
    isLoading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
