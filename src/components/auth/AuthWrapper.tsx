"use client";

import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { LoginPage } from "./LoginPage";

interface AuthWrapperProps {
  children: React.ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
        <span className="ml-4 text-lg text-muted-foreground">
          Loading authentication...
        </span>
      </div>
    );
  }

  return (
    <>
      <SignedOut>
        <LoginPage />
      </SignedOut>
      <SignedIn>{children}</SignedIn>
    </>
  );
}
