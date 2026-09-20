"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface PublicSession {
  type: "local" | "facebook";
  userId: string;
  email?: string;
  name: string;
  avatarUrl?: string | null;
  selectedAdAccountId?: string | null;
  selectedAdAccountName?: string | null;
  selectedBusinessName?: string | null;
}

interface AuthContextValue {
  session: PublicSession | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  logout: async () => {},
});

function userToSession(user: User | null): PublicSession | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  const appMeta = user.app_metadata ?? {};
  return {
    type: appMeta.provider === "facebook" ? "facebook" : "local",
    userId: user.id,
    email: user.email,
    name: meta.full_name ?? meta.name ?? user.email ?? "Usuário",
    avatarUrl: meta.avatar_url ?? null,
    selectedAdAccountId: meta.selected_ad_account_id ?? null,
    selectedAdAccountName: meta.selected_ad_account_name ?? null,
    selectedBusinessName: meta.selected_business_name ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<PublicSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Carrega sessão inicial
    supabase.auth.getUser()
      .then(({ data: { user } }) => {
        setSession(userToSession(user));
        setIsLoading(false);
      })
      .catch(() => {
        setSession(null);
        setIsLoading(false);
      });

    // Escuta mudanças de estado (login, logout, refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, supabaseSession) => {
      setSession(userToSession(supabaseSession?.user ?? null));
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
