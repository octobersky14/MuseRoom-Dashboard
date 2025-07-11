"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AuthUser, DbUser } from "@/types";
import { useUser } from "@clerk/clerk-react";

interface AuthContextType {
  user: AuthUser | null;
  dbUser: DbUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { user: clerkUser, isLoaded } = useUser();
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Upsert user info into Supabase if allowed
  useEffect(() => {
    const syncUser = async () => {
      setLoading(true);
      if (isLoaded && clerkUser) {
        const userId = clerkUser.id;
        const email = clerkUser.primaryEmailAddress.emailAddress;
        const full_name = clerkUser.fullName || null;
        const avatar_url = clerkUser.imageUrl || null;
        // Upsert user into Supabase
        const { data, error } = await supabase
          .from("users")
          .upsert(
            {
              id: userId,
              email,
              full_name,
              avatar_url,
            },
            { onConflict: "id" }
          )
          .select()
          .single();
        if (!error) {
          setDbUser(data);
        } else {
          setDbUser(null);
        }
      } else {
        setDbUser(null);
      }
      setLoading(false);
    };
    syncUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerkUser, isLoaded]);

  return (
    <AuthContext.Provider
      value={{
        user: clerkUser as AuthUser | null,
        dbUser,
        loading,
        signOut: async () => {},
        refreshUser: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
