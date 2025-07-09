import React, { useState, useEffect } from "react";
import { VoiceAgent } from "./components/VoiceAgent";
import { DiscordMessages } from "./components/DiscordMessages";
import { Toaster } from "./components/ui/toaster";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Mic, MessageSquare, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { SplashCursor } from "./components/ui/splash-cursor";

function App() {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 relative overflow-hidden">
      {/* Splash Cursor Background */}
      <div className="fixed inset-0 z-0 opacity-30">
        <SplashCursor
          TRANSPARENT={true}
          BACK_COLOR={{ r: 0.01, g: 0.01, b: 0.03 }}
          SPLAT_RADIUS={0.12}
          SPLAT_FORCE={2500}
          CURL={8}
          DENSITY_DISSIPATION={1.2}
          VELOCITY_DISSIPATION={0.8}
          COLOR_UPDATE_SPEED={2}
          SHADING={false}
        />
      </div>

      {/* Enhanced Background Overlays */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-pink-900/10 pointer-events-none z-1" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(139,92,246,0.08),transparent_70%)] pointer-events-none z-2" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(219,39,119,0.06),transparent_70%)] pointer-events-none z-2" />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.h1
              className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-600 bg-clip-text text-transparent mb-4"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.8, delay: 0.1 }}
            >
              MuseRoom Internal Dashboard
            </motion.h1>
            <motion.p
              className="text-muted-foreground/80 text-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              Talk to your AI assistant to manage Discord messages
            </motion.p>
          </motion.div>

          {/* AI Assistant Animation */}
          <motion.div
            className="flex justify-center mb-12"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <motion.div
              className="relative"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <div className="ai-assistant-container p-6">
                <motion.img
                  src="/ai-assistant-animation.gif"
                  alt="AI Assistant Animation"
                  className="w-96 h-auto object-contain rounded-2xl shadow-2xl ai-assistant-glow max-w-full"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-purple-600/5 to-transparent rounded-2xl pointer-events-none" />
              </div>
            </motion.div>
          </motion.div>

          {/* AI Status Text */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <p className="text-sm text-muted-foreground/70 font-medium">
              ✨ AI Assistant is ready to help you
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <Tabs defaultValue="voice" className="w-full">
              <TabsList className="grid w-full grid-cols-3 card-modern">
                <TabsTrigger
                  value="voice"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white transition-all duration-300 hover:bg-secondary/80"
                >
                  <Mic className="h-4 w-4" />
                  Voice Agent
                </TabsTrigger>
                <TabsTrigger
                  value="messages"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white transition-all duration-300 hover:bg-secondary/80"
                >
                  <MessageSquare className="h-4 w-4" />
                  Messages
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white transition-all duration-300 hover:bg-secondary/80"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="voice" className="mt-6">
                <Card className="card-modern">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      Voice Interface
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <VoiceAgent />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="messages" className="mt-6">
                <Card className="card-modern">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      Discord Messages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DiscordMessages />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="mt-6">
                <Card className="card-modern">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 backdrop-blur-sm border border-border/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                            <span className="text-white font-semibold">🌙</span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              Dark Mode
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Modern dark interface
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setDarkMode(!darkMode)}
                          className="btn-primary px-6 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-105"
                        >
                          {darkMode ? "Switch to Light" : "Switch to Dark"}
                        </button>
                      </div>

                      <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                        <h3 className="font-semibold text-foreground mb-2">
                          ✨ Enhanced Features
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            Glass-morphism UI
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                            Fluid animations
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            Voice recognition
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                            AI-powered responses
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}

export default App;
