/// <reference types="vite/client" />
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/toaster";
import { WifiOff } from "lucide-react";
import { AuthWrapper } from "@/components/auth/AuthWrapper";
import GeminiService from "@/services/geminiService";

// Import page components
import Dashboard from "./pages/Dashboard";
import NotionWorkspace from "./pages/NotionWorkspace";
import Settings from "./pages/Settings"; // NEW
import { Sidebar } from "./components/layout/Sidebar";
import DiscordMessages from "./components/DiscordMessages";
import McpNetlifyChat from "./components/McpNetlifyChat"; // NEW

function App() {
  // Keep only necessary state
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState("");
  // Track sidebar width so content shifts when it expands/collapses
  const [sidebarWidth, setSidebarWidth] = useState<number>(80);

  // Check Gemini API key validity on mount to determine offline mode
  useEffect(() => {
    const verifyApiKey = async () => {
      try {
        const gemini = new GeminiService(import.meta.env.VITE_GEMINI_API_KEY);
        const valid = await gemini.checkApiKey();
        if (!valid) {
          setIsOfflineMode(true);
          setApiErrorMessage(
            GeminiService.apiKeyErrorMessageStatic ||
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

  // Handle sidebar width changes
  const handleSidebarWidthChange = (width: number) => {
    setSidebarWidth(width);
  };

  return (
    <BrowserRouter>
      <div className="flex min-h-screen">
        {/* Fixed-width sidebar */}
        <Sidebar onWidthChange={handleSidebarWidthChange} />

        {/* Main content area that shifts based on sidebar width */}
        <div
          className="flex-1 flex flex-col transition-all duration-300"
          style={{ marginLeft: `${sidebarWidth}px` }}
        >
          {/* Offline mode notification */}
          {isOfflineMode && (
            <div className="bg-amber-600/20 text-amber-300 px-4 py-2 flex items-center text-sm font-medium sticky top-0 z-30">
              <WifiOff className="h-4 w-4 mr-2 shrink-0" />
              <span className="flex-1">
                {apiErrorMessage ||
                  GeminiService.apiKeyErrorMessageStatic ||
                  "Operating in offline mode – some AI features may be limited."}
              </span>
            </div>
          )}

          <main className="flex-1">
            <Routes>
              <Route
                path="/"
                element={
                  <AuthWrapper>
                    <Dashboard />
                  </AuthWrapper>
                }
              />
              <Route
                path="/notion"
                element={
                  <AuthWrapper>
                    <NotionWorkspace />
                  </AuthWrapper>
                }
              />
              <Route
                path="/discord"
                element={
                  <AuthWrapper>
                    <DiscordMessages />
                  </AuthWrapper>
                }
              />
              <Route
                path="/settings"
                element={
                  <AuthWrapper>
                    <Settings />
                  </AuthWrapper>
                }
              />
              {/* MCP Chat test route */}
              <Route
                path="/mcp-chat"
                element={
                  <AuthWrapper>
                    <McpNetlifyChat />
                  </AuthWrapper>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
