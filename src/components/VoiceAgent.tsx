import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MessageSquare,
  Send,
  Settings,
} from "lucide-react";
import { useToast } from "./ui/use-toast";
import { motion } from "framer-motion";
import axios from "axios";
// ElevenLabs API is handled via REST API calls

interface Message {
  id: string;
  text: string;
  timestamp: Date;
  isUser: boolean;
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  preview_url?: string;
}

export function VoiceAgent() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("JBFqnCBsd6RMkjVDRZzb"); // Default ElevenLabs voice (George)
  const [useElevenLabs, setUseElevenLabs] = useState(true);
  const [availableVoices, setAvailableVoices] = useState<ElevenLabsVoice[]>([]);

  const { toast } = useToast();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

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

  useEffect(() => {
    // Initialize speech recognition
    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setCurrentTranscript(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (currentTranscript.trim()) {
          processUserInput(currentTranscript.trim());
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);

        let errorMessage = "Could not recognize speech. Please try again.";
        let errorTitle = "Speech Recognition Error";

        switch (event.error) {
          case "network":
            errorMessage =
              "Network error. Please check your internet connection and try again.";
            errorTitle = "Network Error";
            break;
          case "not-allowed":
            errorMessage =
              "Microphone access denied. Please allow microphone access and try again.";
            errorTitle = "Microphone Permission Required";
            break;
          case "no-speech":
            errorMessage =
              "No speech detected. Please speak clearly and try again.";
            errorTitle = "No Speech Detected";
            break;
          case "audio-capture":
            errorMessage =
              "Audio capture failed. Please check your microphone and try again.";
            errorTitle = "Audio Capture Error";
            break;
          case "service-not-allowed":
            errorMessage =
              "Speech recognition service not allowed. Please try again later.";
            errorTitle = "Service Not Available";
            break;
        }

        toast({
          title: errorTitle,
          description: errorMessage,
          variant: "destructive",
        });
      };

      // Add welcome message
      setTimeout(() => {
        if (messages.length === 0) {
          const welcomeMessage: Message = {
            id: "welcome",
            text: "Hello! I'm your MuseRoom Voice Agent. I can help you read Discord messages and send summaries. Try saying 'Hello' or 'Read latest Discord messages' to get started. Click the microphone button to begin!",
            timestamp: new Date(),
            isUser: false,
          };
          setMessages([welcomeMessage]);
        }
      }, 1000);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [currentTranscript, messages.length]);

  const startListening = () => {
    if (recognitionRef.current) {
      setIsListening(true);
      setCurrentTranscript("");
      recognitionRef.current.start();
    } else {
      toast({
        title: "Speech Recognition Not Available",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive",
      });
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const processUserInput = async (userInput: string) => {
    if (!userInput.trim()) return;

    setIsProcessing(true);
    const userMessage: Message = {
      id: Date.now().toString(),
      text: userInput,
      timestamp: new Date(),
      isUser: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentTranscript("");

    try {
      // Process user command and generate response
      const response = await processCommand(userInput);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        timestamp: new Date(),
        isUser: false,
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Use text-to-speech for AI response
      await speakText(response);
    } catch (error) {
      console.error("Error processing command:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error processing your request.",
        timestamp: new Date(),
        isUser: false,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const processCommand = async (command: string): Promise<string> => {
    const lowerCommand = command.toLowerCase();

    // Simple greeting responses can be handled locally
    if (lowerCommand.includes("hello") || lowerCommand.includes("hi")) {
      return "Hello! I'm your voice assistant. I can help you read Discord messages, send summaries, or manage your Discord channels. What would you like me to do?";
    }

    if (lowerCommand.includes("help")) {
      return "I can help you with Discord messages. Try saying 'read latest Discord messages' or 'send Discord summary' to get started.";
    }

    // Route Discord-related commands to the webhook
    if (
      lowerCommand.includes("discord") ||
      lowerCommand.includes("message") ||
      lowerCommand.includes("read") ||
      lowerCommand.includes("send") ||
      lowerCommand.includes("summary") ||
      lowerCommand.includes("latest") ||
      lowerCommand.includes("channel")
    ) {
      return await handleDiscordCommand(command);
    }

    // For other commands, also try the Discord webhook since the AI can handle various requests
    return await handleDiscordCommand(command);
  };

  const handleDiscordCommand = async (command: string): Promise<string> => {
    const N8N_WEBHOOK_URL =
      import.meta.env.VITE_DISCORD_WEBHOOK_URL ||
      "https://hadleycarr04.app.n8n.cloud/webhook/discord-message";

    try {
      // Send the voice message to the n8n webhook as specified by boss
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: command,
          timestamp: new Date().toISOString(),
          source: "voice_app",
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Check if the n8n automation returned a response
        if (data && data.response) {
          return data.response;
        } else if (data && data.success) {
          return "I've successfully processed your request through the Discord automation!";
        } else {
          return "Your message has been sent to the Discord automation system for processing.";
        }
      } else {
        throw new Error(`Webhook responded with status: ${response.status}`);
      }
    } catch (error) {
      console.error("Discord webhook error:", error);

      // Provide helpful fallback response
      return (
        "I've received your voice command but couldn't connect to the Discord automation system right now. Your message was: '" +
        command +
        "'. The system would normally process this through AI analysis and handle Discord integration automatically."
      );
    }
  };

  const speakText = async (text: string) => {
    try {
      setIsSpeaking(true);

      // Try ElevenLabs first if available
      if (useElevenLabs && elevenLabsApiKey) {
        try {
          const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`,
            {
              text: text,
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
            // Convert ArrayBuffer to AudioBuffer
            const audioContext = audioContextRef.current || new AudioContext();
            audioContextRef.current = audioContext;

            const audioBuffer = await audioContext.decodeAudioData(
              response.data
            );
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);

            source.onended = () => {
              setIsSpeaking(false);
            };

            source.start(0);

            toast({
              title: "ElevenLabs Voice",
              description: "Using high-quality AI voice synthesis",
              variant: "default",
            });

            return;
          }
        } catch (elevenLabsError) {
          console.warn(
            "ElevenLabs failed, falling back to Web Speech API:",
            elevenLabsError
          );

          toast({
            title: "Fallback to Browser Voice",
            description: "ElevenLabs unavailable, using browser voice",
            variant: "default",
          });
        }
      }

      // Fallback to Web Speech API
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 0.8;

        utterance.onend = () => {
          setIsSpeaking(false);
        };

        utterance.onerror = () => {
          setIsSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);

        if (!useElevenLabs) {
          toast({
            title: "Browser Voice",
            description: "Add ElevenLabs API key for premium AI voices",
            variant: "default",
          });
        }
      } else {
        setIsSpeaking(false);
        toast({
          title: "Voice Not Available",
          description: "Text-to-speech not supported in this browser",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Text-to-speech error:", error);
      setIsSpeaking(false);
      toast({
        title: "Voice Error",
        description: "Failed to generate speech",
        variant: "destructive",
      });
    }
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  return (
    <div className="space-y-6">
      {/* Voice Visualizer */}
      <div className="flex justify-center">
        <motion.div
          className={`voice-visualizer ${isListening ? "active" : ""}`}
          animate={{
            scale: isListening ? [1, 1.1, 1] : 1,
            opacity: isProcessing ? 0.5 : 1,
          }}
          transition={{
            duration: 1,
            repeat: isListening ? Infinity : 0,
            ease: "easeInOut",
          }}
        >
          {isListening ? (
            <Mic className="h-12 w-12 text-white" />
          ) : (
            <MicOff className="h-12 w-12 text-white" />
          )}
        </motion.div>
      </div>

      {/* Voice Controls */}
      <div className="flex justify-center gap-4">
        <Button
          onClick={isListening ? stopListening : startListening}
          variant={isListening ? "destructive" : "default"}
          size="lg"
          disabled={isProcessing}
        >
          {isListening ? (
            <MicOff className="h-5 w-5 mr-2" />
          ) : (
            <Mic className="h-5 w-5 mr-2" />
          )}
          {isListening ? "Stop Listening" : "Start Listening"}
        </Button>

        <Button
          onClick={isSpeaking ? stopSpeaking : undefined}
          variant={isSpeaking ? "destructive" : "secondary"}
          size="lg"
          disabled={!isSpeaking}
        >
          {isSpeaking ? (
            <VolumeX className="h-5 w-5 mr-2" />
          ) : (
            <Volume2 className="h-5 w-5 mr-2" />
          )}
          {isSpeaking ? "Stop Speaking" : "Speaking"}
        </Button>
      </div>

      {/* Current Transcript */}
      {currentTranscript && (
        <Card className="bg-secondary/50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Listening...</p>
            <p className="text-lg">{currentTranscript}</p>
          </CardContent>
        </Card>
      )}

      {/* Status */}
      <div className="text-center">
        {isProcessing && (
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="text-sm text-muted-foreground">Processing...</span>
          </div>
        )}
      </div>

      {/* Conversation History */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex ${
              message.isUser ? "justify-end" : "justify-start"
            }`}
          >
            <Card
              className={`max-w-md ${
                message.isUser
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary"
              }`}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  {message.isUser ? (
                    <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                      <span className="text-xs font-semibold">U</span>
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-purple-500 flex items-center justify-center">
                      <span className="text-xs font-semibold text-white">
                        AI
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm">{message.text}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => processUserInput("read latest Discord messages")}
          disabled={isProcessing}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Read Messages
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => processUserInput("send Discord summary")}
          disabled={isProcessing}
        >
          <Send className="h-4 w-4 mr-2" />
          Send Summary
        </Button>
      </div>

      {/* Voice Settings */}
      <Card className="bg-secondary/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="h-4 w-4" />
            <h3 className="font-semibold">Voice Settings</h3>
          </div>

          <div className="space-y-3">
            {/* Voice Provider Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Voice Provider</span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs ${
                    !useElevenLabs ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Browser
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUseElevenLabs(!useElevenLabs)}
                  className="h-8 px-2"
                >
                  {useElevenLabs ? "Switch to Browser" : "Switch to ElevenLabs"}
                </Button>
                <span
                  className={`text-xs ${
                    useElevenLabs ? "text-primary" : "text-muted-foreground"
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
                  <span className="text-sm font-medium">AI Voice</span>
                  <span className="text-xs text-muted-foreground">
                    {availableVoices.length} voices available
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {availableVoices.map((voice) => (
                    <Button
                      key={voice.voice_id}
                      variant={
                        selectedVoice === voice.voice_id ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setSelectedVoice(voice.voice_id)}
                      className="text-xs h-8"
                    >
                      {voice.name}
                    </Button>
                  ))}
                </div>

                {availableVoices.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    Loading voices...
                  </div>
                )}
              </div>
            )}

            {/* Voice Test */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Test Voice</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  speakText("Hello! This is a test of the voice system.")
                }
                disabled={isSpeaking}
                className="h-8 px-3"
              >
                {isSpeaking ? "Speaking..." : "Test Voice"}
              </Button>
            </div>

            {/* API Key Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">API Status</span>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  useElevenLabs
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                }`}
              >
                {useElevenLabs ? "ElevenLabs Connected" : "Browser Voice Only"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
