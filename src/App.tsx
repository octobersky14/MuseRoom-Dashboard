/// <reference types="vite/client" />
import React, { useState, useEffect } from "react";
import { VoiceAgent } from "./components/VoiceAgent";
import { DiscordMessages } from "./components/DiscordMessages";
import { NotionWorkspace } from "./components/NotionWorkspace";
import { Toaster } from "./components/ui/toaster";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Button } from "./components/ui/button";
import {
  MessageSquare,
  Settings,
  Volume2,
  Brain,
  BookOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import { SplashCursor } from "./components/ui/splash-cursor";
import axios from "axios";
import { useToast } from "./components/ui/use-toast";
import { AuthWrapper } from "@/components/auth/AuthWrapper";
import { PromptInputBox } from "./components/ui/ai-prompt-box";

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  preview_url?: string;
}

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState("JBFqnCBsd6RMkjVDRZzb"); // Default ElevenLabs voice (George)
  const [useElevenLabs, setUseElevenLabs] = useState(true);
  const [availableVoices, setAvailableVoices] = useState<ElevenLabsVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [activeAssistant, setActiveAssistant] = useState<
    "general" | "discord" | "notion"
  >("general");

  const { toast } = useToast();
  const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

  // Handler for ai-prompt submission
  const handlePromptSend = (message: string) => {
    setInitialPrompt(message);
    setShowChat(true);
    setActiveAssistant("general"); // Default to general AI when typing a prompt
  };

  // Handler for logo click (existing behavior)
  const handleLogoClick = () => {
    setShowChat(true);
    setInitialPrompt(null);
    setActiveAssistant("general"); // Default to general AI assistant when clicking the logo
    if ((window as any).toggleVoiceListening) {
      (window as any).toggleVoiceListening();
    }
  };

  // Handler for AI intent detection (for navigation, etc.)
  const handleIntent = (intent: string, data?: any) => {
    console.log("Intent detected:", intent, data);

    switch (intent) {
      case "navigate":
        if (data?.target === "discord" || data?.target === "messages") {
          setActiveAssistant("discord");
        } else if (
          data?.target === "notion" ||
          data?.target === "workspace" ||
          data?.target === "notes" ||
          data?.target === "tasks"
        ) {
          setActiveAssistant("notion");
        } else if (
          data?.target === "voice" ||
          data?.target === "voice assistant" ||
          data?.target === "general" ||
          data?.target === "assistant"
        ) {
          setActiveAssistant("general");
        }
        break;
      case "show_messages":
        setActiveAssistant("discord");
        break;
      case "show_workspace":
      case "show_notion":
        setActiveAssistant("notion");
        break;
      case "voice_mode":
        setActiveAssistant("general");
        break;
      default:
        // Handle other intents as needed
        break;
    }
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Initialize ElevenLabs
  useEffect(() => {
    if (elevenLabsApiKey) {
      loadElevenLabsVoices();
      setUseElevenLabs(true);
    } else {
      console.info(
        "No ElevenLabs API key found, using Web Speech API fallback"
      );
      setUseElevenLabs(false);
    }
  }, [elevenLabsApiKey]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const speakWelcome = () => {
        if ((window as any).speakWelcome) {
          (window as any).speakWelcome();
        }
      };
      // Wait a short moment to ensure VoiceAgent sets the function
      setTimeout(speakWelcome, 1000);
    }
  }, []);

  const loadElevenLabsVoices = async () => {
    if (!elevenLabsApiKey) return;

    try {
      const response = await axios.get("https://api.elevenlabs.io/v1/voices", {
        headers: {
          "xi-api-key": elevenLabsApiKey,
        },
      });
      if (response.data && response.data.voices) {
        setAvailableVoices(response.data.voices.slice(0, 10)); // Limit to first 10 voices
      }
    } catch (error) {
      console.warn("Failed to load ElevenLabs voices:", error);
      setUseElevenLabs(false);
    }
  };

  const testVoice = async () => {
    if (!elevenLabsApiKey) {
      toast({
        title: "ElevenLabs API Key Required",
        description:
          "Please add your ElevenLabs API key to use voice synthesis",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSpeaking(true);
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`,
        {
          text: "Hello! This is a test of the voice system.",
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        },
        {
          headers: {
            "xi-api-key": elevenLabsApiKey,
            "Content-Type": "application/json",
          },
          responseType: "arraybuffer",
        }
      );

      if (response.data) {
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(response.data);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        source.onended = () => {
          setIsSpeaking(false);
        };

        source.start(0);

        toast({
          title: "Voice Test",
          description: "Testing ElevenLabs voice synthesis",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Voice test error:", error);
      setIsSpeaking(false);
      toast({
        title: "Voice Test Failed",
        description: "Failed to test voice. Please check your API key.",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 relative overflow-hidden">
        {/* Splash Cursor Background */}
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
                click the logo below to begin :)
              </motion.p>
            </motion.div>

            {/* AI Assistant Animation */}
            <motion.div
              className="flex justify-center mb-4"
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
                    className="w-96 h-auto object-contain rounded-2xl shadow-2xl ai-assistant-glow max-w-full transition-all duration-300 hover:shadow-purple-500/25"
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
                  {/* Click instruction */}
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-center">
                    <p className="text-xs text-muted-foreground/70 font-medium bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border/50">
                      Click to activate AI assistant
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* AI Assistants Section */}
            <div className="flex justify-center mb-8">
              <div className="w-full max-w-4xl">
                {!showChat ? (
                  <div className="space-y-6">
                    <div className="max-w-xl mx-auto">
                      <PromptInputBox
                        onSend={(msg) => handlePromptSend(msg)}
                        placeholder="Ask MuseRoom anything..."
                      />
                    </div>

                    {/* Notion Workspace Section */}
                    <div className="w-full">
                      <NotionWorkspace className="mx-auto" />
                    </div>
                  </div>
                ) : (
                  <Card className="bg-gradient-to-br from-purple-900/30 via-[#232136]/80 to-pink-900/30 border border-purple-500/40 backdrop-blur-xl">
                    <Tabs
                      value={activeAssistant}
                      onValueChange={(value) =>
                        setActiveAssistant(
                          value as "general" | "discord" | "notion"
                        )
                      }
                    >
                      <TabsList className="grid w-full grid-cols-3 bg-gray-800/60 border border-gray-600/30">
                        <TabsTrigger
                          value="general"
                          className="flex items-center gap-2 data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-300"
                        >
                          <Brain className="w-4 h-4" />
                          AI Assistant
                        </TabsTrigger>
                        <TabsTrigger
                          value="discord"
                          className="flex items-center gap-2 data-[state=active]:bg-green-600/20 data-[state=active]:text-green-300"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Discord Messages
                        </TabsTrigger>
                        <TabsTrigger
                          value="notion"
                          className="flex items-center gap-2 data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300"
                        >
                          <BookOpen className="w-4 h-4" />
                          Notion Workspace
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="general" className="mt-0">
                        <VoiceAgent
                          selectedVoice={selectedVoice}
                          useElevenLabs={useElevenLabs}
                          availableVoices={availableVoices}
                          elevenLabsApiKey={elevenLabsApiKey}
                          initialPrompt={initialPrompt}
                          onPromptHandled={() => setInitialPrompt(null)}
                          showChat={true}
                          setShowChat={setShowChat}
                        />
                      </TabsContent>

                      <TabsContent value="discord" className="mt-0">
                        <DiscordMessages />
                      </TabsContent>

                      <TabsContent value="notion" className="mt-0 p-0">
                        <NotionWorkspace />
                      </TabsContent>
                    </Tabs>
                  </Card>
                )}
              </div>
            </div>

            {/* AI Status Text */}
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              <p
                className="text-sm text-muted-foreground/70 font-medium"
                id="voice-status-text"
              ></p>
            </motion.div>

            {/* Tabbed AI Assistant Interface */}
          </div>
        </div>
      </div>
      <Toaster />
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
    </AuthWrapper>
  );
}

export default App;
