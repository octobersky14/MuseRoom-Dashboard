"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Github, Mail, Bot } from "lucide-react";

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Check if we're using placeholder credentials
  const isUsingPlaceholders =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder");

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign in with Google",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign in with GitHub",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Bot className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Welcome to MuseRoom
          </CardTitle>
          <CardDescription className="text-center">
            Your AI-powered task automation and collaboration hub
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isUsingPlaceholders && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Development Mode:</strong> Authentication is disabled
                because Supabase environment variables are not configured. The
                app will run in demo mode with placeholder data.
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Button
              onClick={handleGoogleLogin}
              disabled={loading || isUsingPlaceholders}
              className="w-full"
              variant="outline"
            >
              <Mail className="h-4 w-4 mr-2" />
              Continue with Google
            </Button>
            <Button
              onClick={handleGitHubLogin}
              disabled={loading || isUsingPlaceholders}
              className="w-full"
              variant="outline"
            >
              <Github className="h-4 w-4 mr-2" />
              Continue with GitHub
            </Button>
          </div>

          {isUsingPlaceholders && (
            <div className="space-y-2">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Development Mode
                  </span>
                </div>
              </div>
              <Button
                onClick={() => {
                  // Mock successful authentication for demo
                  toast({
                    title: "Demo Mode",
                    description:
                      "Entering development mode with placeholder data.",
                  });
                  // This will bypass authentication - the app will show login page but user can see the structure
                }}
                className="w-full"
                variant="secondary"
              >
                Continue in Demo Mode
              </Button>
            </div>
          )}

          <div className="text-xs text-muted-foreground text-center space-y-2">
            <p>
              By signing in, you agree to our terms of service and privacy
              policy.
            </p>
            <p>
              Connect your accounts to enable AI-powered automation across
              Notion and GitHub.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
