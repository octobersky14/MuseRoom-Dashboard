import React, { useState, useEffect } from "react";
import { VoiceAgent } from "@/components/VoiceAgent";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { motion } from "framer-motion";
import { SplashCursor } from "@/components/ui/splash-cursor";
import {
  Brain,
  MessageSquare,
  FileText,
  Calendar,
  Activity,
  Users,
  Clock,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { McpStatusIndicator } from "@/components/McpStatusIndicator";
import { useAIAssistant } from "@/hooks/useAIAssistant";

const Dashboard: React.FC = () => {
  // AI Assistant hook for MCP functionality
  const { mcpStatus, mcpTools } = useAIAssistant();

  // State
  const [selectedVoice, _setSelectedVoice] = useState(
    "JBFqnCBsd6RMkjVDRZzb"
  ); // Default ElevenLabs voice (George)
  const [useElevenLabs, _setUseElevenLabs] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  // Setter kept for future updates; may be unused for now
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [recentActivities, _setRecentActivities] = useState([
    {
      id: 1,
      title: "Updated AI Team project",
      time: "10 minutes ago",
      type: "notion",
    },
    {
      id: 2,
      title: "New message in #general",
      time: "25 minutes ago",
      type: "discord",
    },
    {
      id: 3,
      title: "Meeting scheduled: Weekly Sync",
      time: "1 hour ago",
      type: "calendar",
    },
    {
      id: 4,
      title: "Task completed: Implement workspace analyzer",
      time: "3 hours ago",
      type: "notion",
    },
  ]);

  // currently not used in this component; keep underscored to avoid TS warning
  const { toast: _toast } = useToast();
  const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

  // Handler for ai-prompt submission
  const handlePromptSend = (message: string) => {
    setInitialPrompt(message);
    setShowChat(true);
  };

  // Handler for logo click
  const handleLogoClick = () => {
    setShowChat(true);
    setInitialPrompt(null);
    if ((window as any).toggleVoiceListening) {
      (window as any).toggleVoiceListening();
    }
  };

  // Stats data
  const statsData = [
    {
      title: "AI Interactions",
      value: "328",
      icon: <Brain className="h-4 w-4" />,
      color: "from-purple-500 to-purple-700",
    },
    {
      title: "Discord Messages",
      value: "124",
      icon: <MessageSquare className="h-4 w-4" />,
      color: "from-green-500 to-green-700",
    },
    {
      title: "Notion Pages",
      value: "56",
      icon: <FileText className="h-4 w-4" />,
      color: "from-blue-500 to-blue-700",
    },
    {
      title: "Calendar Events",
      value: "12",
      icon: <Calendar className="h-4 w-4" />,
      color: "from-amber-500 to-amber-700",
    },
  ];

  /* ----------------------------------------------------------------
   *  Strong Dark-Mode Enforcement
   *  – Always keep the `dark` class on <html>
   *  – Re-add it immediately if something removes it (e.g. 3rd-party libs)
   * ---------------------------------------------------------------- */
  useEffect(() => {
    // Ensure dark mode is set on first render
    document.documentElement.classList.add("dark");

    // MutationObserver to re-apply dark mode if removed
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class" &&
          !document.documentElement.classList.contains("dark")
        ) {
          document.documentElement.classList.add("dark");
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    // Cleanup – keep dark mode when unmounting
    return () => {
      observer.disconnect();
      document.documentElement.classList.add("dark");
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 opacity-40">
        <SplashCursor
          TRANSPARENT={true}
          BACK_COLOR={{ r: 0.01, g: 0.01, b: 0.03 }}
          SPLAT_RADIUS={0.15}
          SPLAT_FORCE={3500}
          CURL={12}
          DENSITY_DISSIPATION={0.9}
          VELOCITY_DISSIPATION={0.6}
          COLOR_UPDATE_SPEED={8}
          SHADING={true}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-pink-900/10 pointer-events-none z-1" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(139,92,246,0.08),transparent_70%)] pointer-events-none z-2" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(219,39,119,0.06),transparent_70%)] pointer-events-none z-2" />

      {/* Main Content (shifted to account for the 80 px collapsed sidebar;
          the sidebar expands over the content on hover, so a fixed offset
          of 80 px keeps things aligned without hard-coding the expanded
          width) */}
      <div className="container mx-auto px-4 py-6 relative z-10 transition-all duration-300">
        <div className="max-w-6xl mx-auto">
          {/* Header Section */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.h1
              className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-600 bg-clip-text text-transparent mb-4"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.8, delay: 0.1 }}
            >
              MuseRoom Dashboard
            </motion.h1>
            <motion.p
              className="text-muted-foreground/80 text-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              click below to begin :)
            </motion.p>
          </motion.div>

          {/* AI Assistant Animation */}
          <motion.div
            className="flex justify-center mb-6"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <motion.div
              className="relative cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              onClick={handleLogoClick}
            >
              <div className="ai-assistant-container p-6 relative">
                <motion.img
                  id="ai-assistant-gif"
                  src="/ai-assistant-animation.gif"
                  alt="AI Assistant Animation - Click to activate voice"
                  className="w-64 h-auto object-contain rounded-2xl shadow-2xl ai-assistant-glow max-w-full transition-all duration-300 hover:shadow-purple-500/25"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                  style={{
                    filter: "brightness(1) contrast(1) saturate(1)",
                    transition: "filter 0.1s ease-out",
                  }}
                />
                {/* Click indicator overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-purple-600/5 to-transparent rounded-2xl pointer-events-none" />
                {/* Audio level indicator rings */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  id="audio-level-rings"
                >
                  <div
                    className="absolute inset-0 rounded-2xl border-2 border-purple-400/0 transition-all duration-100"
                    id="audio-ring-1"
                  ></div>
                  <div
                    className="absolute inset-2 rounded-2xl border-2 border-blue-400/0 transition-all duration-150"
                    id="audio-ring-2"
                  ></div>
                  <div
                    className="absolute inset-4 rounded-2xl border-2 border-cyan-400/0 transition-all duration-200"
                    id="audio-ring-3"
                  ></div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Prompt Input Box or AI Assistant */}
          <div className="mb-8">
            {!showChat ? (
              <div className="max-w-xl mx-auto">
                <PromptInputBox
                  onSend={(msg) => handlePromptSend(msg)}
                  placeholder="Ask MuseRoom anything..."
                />
              </div>
            ) : (
              <Card className="bg-gradient-to-br from-purple-900/30 via-[#232136]/80 to-pink-900/30 border border-purple-500/40 backdrop-blur-xl">
                <VoiceAgent
                  selectedVoice={selectedVoice}
                  useElevenLabs={useElevenLabs}
                  elevenLabsApiKey={elevenLabsApiKey}
                  initialPrompt={initialPrompt}
                  onPromptHandled={() => setInitialPrompt(null)}
                  showChat={true}
                />
              </Card>
            )}
          </div>

          {/* Stats Cards Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statsData.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * index }}
              >
                <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm hover:border-gray-700/60 transition-all duration-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400 mb-1">
                          {stat.title}
                        </p>
                        <p className="text-2xl font-bold text-white">
                          {stat.value}
                        </p>
                      </div>
                      <div
                        className={`p-2 rounded-full bg-gradient-to-br ${stat.color} text-white`}
                      >
                        {stat.icon}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* MCP Status Indicator */}
          <div className="mb-8">
            <McpStatusIndicator
              mcpStatus={mcpStatus}
              mcpTools={mcpTools}
              serverName="Notion MCP"
            />
          </div>

          {/* Recent Activity and Quick Access Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Recent Activity */}
            <Card className="lg:col-span-2 bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-purple-400" />
                    Recent Activity
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs">
                    View All
                  </Button>
                </div>
                <CardDescription>
                  Latest updates from your workspace
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start p-3 rounded-lg hover:bg-gray-800/40 transition-colors"
                    >
                      <div className="mr-3 mt-0.5">
                        {activity.type === "notion" ? (
                          <FileText className="h-5 w-5 text-blue-400" />
                        ) : activity.type === "discord" ? (
                          <MessageSquare className="h-5 w-5 text-green-400" />
                        ) : (
                          <Calendar className="h-5 w-5 text-amber-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-200">
                          {activity.title}
                        </p>
                        <p className="text-xs text-gray-400 flex items-center mt-1">
                          <Clock className="h-3 w-3 mr-1 inline" />
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Access */}
            <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center">
                  <Users className="h-5 w-5 mr-2 text-purple-400" />
                  Team Overview
                </CardTitle>
                <CardDescription>Your workspace teams</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {["Agentic AI", "Design/UI UX", "Marketing", "DAW"].map(
                    (team, i) => (
                      <div
                        key={team}
                        className="p-3 rounded-lg border border-gray-800 hover:border-purple-500/30 hover:bg-gray-800/40 transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-200">
                            {team}
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-400">
                            {[8, 5, 4, 3][i]} members
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-gray-400">
                          {
                            [
                              "Working on AI integration features",
                              "Redesigning the dashboard UI",
                              "Planning Q3 marketing campaign",
                              "Audio engine improvements",
                            ][i]
                          }
                        </div>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CSS for controlling GIF animation speed based on audio */}
      <style>{`
        /* CSS for controlling GIF animation speed based on audio - Clean speed-only approach */
        .ai-assistant-gif-idle {
          animation-duration: 1.2s;
        }
        
        .ai-assistant-gif-slow {
          animation-duration: 0.9s;
        }
        
        .ai-assistant-gif-normal {
          animation-duration: 0.6s;
        }
        
        .ai-assistant-gif-fast {
          animation-duration: 0.3s;
        }
        
        .ai-assistant-gif-intense {
          animation-duration: 0.15s;
        }
        
        .ai-assistant-gif-speaking {
          animation-duration: 0.4s; /* Fast speed for AI speaking */
        }
        
        /* Clean GIF element - no visual effects, just speed control */
        #ai-assistant-gif {
          position: relative;
          /* The GIF's natural animation speed will be controlled by CSS animation-duration */
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
