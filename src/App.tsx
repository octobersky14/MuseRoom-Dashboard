/// <reference types="vite/client" />
import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/toaster";
import { AuthWrapper } from "@/components/auth/AuthWrapper";

// Import page components
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings"; // NEW
import Chat from "./pages/Chat"; // NEW
import { Sidebar } from "./components/layout/Sidebar";
import DiscordMessages from "./components/DiscordMessages";

function App() {
  // Track sidebar width so content shifts when it expands/collapses
  const [sidebarWidth, setSidebarWidth] = useState<number>(80);

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
              <Route
                path="/chat"
                element={
                  <AuthWrapper>
                    <Chat />
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
