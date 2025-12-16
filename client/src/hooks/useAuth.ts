import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import type { User } from "@shared/schema";
import { supabase } from "@/lib/supabase";
import { hasAccess as checkAccess, type UserRole, type PageKey } from "@shared/permissions";

export function useAuth() {
  const [supabaseSession, setSupabaseSession] = useState<any>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Check Supabase session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseSession(session);
      setIsCheckingSession(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user from backend (which syncs with Supabase)
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: Infinity,
    enabled: !!supabaseSession, // Only fetch if Supabase session exists
  });

  const role = (user?.role as UserRole) || null;

  const hasAccess = useCallback((page: PageKey): boolean => {
    return checkAccess(role, page);
  }, [role]);

  return {
    user: user ?? null,
    role,
    isLoading: isLoading || isCheckingSession,
    isAuthenticated: !!user && !!supabaseSession,
    hasAccess,
  };
}
