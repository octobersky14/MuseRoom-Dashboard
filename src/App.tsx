/// <reference types="vite/client" />
import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/toaster";
import { WifiOff } from "lucide-react";
import { AuthWrapper } from "@/components/auth/AuthWrapper";
import GeminiService from "@/services/geminiService";

// Import page components
import Dashboard from "./pages/Dashboard";
import NotionWorkspace from "./pages/NotionWorkspace";

// Import layout components
import { Sidebar } from "./components/layout/Sidebar";

function App() {
  // Keep only necessary state
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState("");

  // Check Gemini API key validity on mount to determine offline mode
  useEffect(() => {
    const verifyApiKey = async () => {
      try {
        const gemini = new GeminiService(import.meta.env.VITE_GEMINI_API_KEY);
        const valid = await gemini.checkApiKey();
        if (!valid) {
          setIsOfflineMode(true);
          setApiErrorMessage(
            gemini.apiKeyErrorMessage ||
              "The Gemini API is unavailable. Running in offline mode."
          );
        }
      } catch (err) {
        console.error("Gemini API verification failed:", err);
        setIsOfflineMode(true);
        setApiErrorMessage(
          "Failed to contact Gemini API. Offline mode activated."
        );
      }
    };
    verifyApiKey();
  }, []);

  return (
    <AuthWrapper>
      <BrowserRouter>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-gray-900/30 relative">
          {/* Offline-mode Banner */}
          {isOfflineMode && (
            <div className="fixed top-0 left-0 right-0 z-50 bg-amber-700/90 backdrop-blur-sm border-b border-amber-500/40 text-sm text-amber-100 flex items-center px-4 py-2">
              <WifiOff className="h-4 w-4 mr-2 shrink-0" />
              <span className="flex-1">
                {apiErrorMessage ||
                  "Operating in offline mode – some AI features may be limited."}
              </span>
            </div>
          )}

          {/* Simplified background */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/5 via-transparent to-pink-900/5 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(139,92,246,0.05),transparent_70%)] pointer-events-none" />

          {/* Sidebar */}
          <Sidebar />

          {/* Main Content Area */}
          <main className={`relative z-10 ${isOfflineMode ? "pt-10" : ""}`}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/notion" element={<NotionWorkspace />} />
              <Route path="/assistant" element={<Dashboard />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
        <Toaster />
      </BrowserRouter>
    </AuthWrapper>
  );
}

export default App;
