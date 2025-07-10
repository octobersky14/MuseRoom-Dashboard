/// <reference types="vite/client" />
import React, { useState, useEffect } from "react";
import { VoiceAgent } from "./components/VoiceAgent";
import { DiscordMessages } from "./components/DiscordMessages";
import { Toaster } from "./components/ui/toaster";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Button } from "./components/ui/button";
import { Mic, MessageSquare, Settings, Volume2 } from "lucide-react";
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

  const { toast } = useToast();
  const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

  // Handler for ai-prompt submission
  const handlePromptSend = (message: string) => {
    setInitialPrompt(message);
    setShowChat(true);
  };

  // Handler for logo click (existing behavior)
  const handleLogoClick = () => {
    setShowChat(true);
    setInitialPrompt(null);
    if ((window as any).toggleVoiceListening) {
      (window as any).toggleVoiceListening();
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
                      Click to activate voice assistant
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* AI Prompt Button/Box under the logo */}
            {!showChat && (
              <div className="flex justify-center mb-8">
                <div className="w-full max-w-xl">
                  <PromptInputBox
                    onSend={(msg) => handlePromptSend(msg)}
                    placeholder="Ask MuseRoom anything..."
                  />
                </div>
              </div>
            )}

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

            {/* Chat/VoiceAgent - only show after prompt or logo click */}
            {showChat && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
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
                        <VoiceAgent
                          selectedVoice={selectedVoice}
                          useElevenLabs={useElevenLabs}
                          availableVoices={availableVoices}
                          elevenLabsApiKey={elevenLabsApiKey}
                          initialPrompt={initialPrompt}
                          onPromptHandled={() => setInitialPrompt(null)}
                        />
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
                                <span className="text-white font-semibold">
                                  🌙
                                </span>
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

                          {/* Voice Settings */}
                          <div className="p-4 rounded-lg bg-secondary/50 backdrop-blur-sm border border-border/50">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                                <Volume2 className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground">
                                  Voice Settings
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Configure AI voice synthesis
                                </p>
                              </div>
                            </div>

                            <div className="space-y-4">
                              {/* Voice Provider Toggle */}
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  Voice Provider
                                </span>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xs ${
                                      !useElevenLabs
                                        ? "text-primary"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    Browser
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setUseElevenLabs(!useElevenLabs)
                                    }
                                    className="h-8 px-2"
                                  >
                                    {useElevenLabs
                                      ? "Switch to Browser"
                                      : "Switch to ElevenLabs"}
                                  </Button>
                                  <span
                                    className={`text-xs ${
                                      useElevenLabs
                                        ? "text-primary"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    ElevenLabs
                                  </span>
                                </div>
                              </div>

                              {/* ElevenLabs Voice Selection */}
                              {useElevenLabs && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">
                                      AI Voice
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {availableVoices.length} voices available
                                    </span>
                                  </div>

                                  {availableVoices.length > 0 ? (
                                    <select
                                      value={selectedVoice}
                                      onChange={(e) =>
                                        setSelectedVoice(e.target.value)
                                      }
                                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                                    >
                                      {availableVoices.map((voice) => (
                                        <option
                                          key={voice.voice_id}
                                          value={voice.voice_id}
                                        >
                                          {voice.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="text-xs text-muted-foreground text-center py-2">
                                      Loading voices...
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Voice Test */}
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  Test Voice
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={testVoice}
                                  disabled={isSpeaking}
                                  className="h-8 px-3"
                                >
                                  {isSpeaking ? "Speaking..." : "Test Voice"}
                                </Button>
                              </div>

                              {/* API Key Status */}
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  API Status
                                </span>
                                <span
                                  className={`text-xs px-2 py-1 rounded ${
                                    elevenLabsApiKey
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                  }`}
                                >
                                  {elevenLabsApiKey
                                    ? "ElevenLabs Connected"
                                    : "API Key Required"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </motion.div>
            )}
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
