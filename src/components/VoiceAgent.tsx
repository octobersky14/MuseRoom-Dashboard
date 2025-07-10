import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Volume2, VolumeX, Settings, Loader2 } from "lucide-react";
import { useToast } from "./ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useVoiceAssistant } from "../../useVoiceAssistant";
import useDirectSpeechRecognition, {
  RecognitionStatus,
  TranscriptConfidence,
} from "../../useDirectSpeechRecognition";

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

interface VoiceAgentProps {
  selectedVoice: string;
  useElevenLabs: boolean;
  availableVoices: ElevenLabsVoice[];
  elevenLabsApiKey: string;
}

export function VoiceAgent({
  selectedVoice,
  useElevenLabs,
  availableVoices,
  elevenLabsApiKey,
}: VoiceAgentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);

  const { toast } = useToast();
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

  // Use the sophisticated direct speech recognition hook
  const speechRecognition = useDirectSpeechRecognition();

  // Use the advanced voice assistant hook with ElevenLabs integration
  const voiceAssistant = useVoiceAssistant({
    enabled: isVoiceEnabled && !isMuted,
    onTranscript: handleUserTranscript,
    circleElementRef: null, // Will be handled by the main GIF
    muted: isMuted,
    elevenLabsApiKey: useElevenLabs ? elevenLabsApiKey : "",
    elevenLabsVoiceId: selectedVoice,
    waveformCanvas: waveformCanvasRef.current,
    onSpeakingChange: (speaking) => {
      console.log("Assistant speaking:", speaking);
    },
    onError: (error) => {
      console.error("Voice Assistant Error:", error);
      toast({
        title: "Voice Assistant Error",
        description: error,
        variant: "destructive",
      });
    },
  });

  // Handle user speech transcript
  function handleUserTranscript(transcript: string) {
    if (!transcript.trim()) return;

    console.log("User transcript received:", transcript);
    setCurrentTranscript(transcript);
    processUserInput(transcript.trim());
  }

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: "welcome",
      text: "Hello! Welcome to MuseRoom! Click the AI assistant animation above to start your voice assistant. I can help you read Discord messages and send summaries. Try saying 'Hello' or 'Read latest Discord messages' to get started!",
      timestamp: new Date(),
      isUser: false,
    };
    setMessages([welcomeMessage]);
  }, []);

  // Handle speech recognition errors
  useEffect(() => {
    if (speechRecognition.errorMessage) {
      toast({
        title: "Speech Recognition Error",
        description: speechRecognition.errorMessage,
        variant: "destructive",
      });
    }
  }, [speechRecognition.errorMessage, toast]);

  const processUserInput = useCallback(
    async (userInput: string) => {
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

        // Speak the response using the voice assistant
        if (!isMuted && response) {
          await voiceAssistant.speak(response);
        }
      } catch (error) {
        console.error("Error processing user input:", error);
        const errorMessage =
          "I'm sorry, I encountered an error processing your request. Please try again.";

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: errorMessage,
          timestamp: new Date(),
          isUser: false,
        };

        setMessages((prev) => [...prev, aiMessage]);

        if (!isMuted) {
          await voiceAssistant.speak(errorMessage);
        }

        toast({
          title: "Processing Error",
          description: "Failed to process your request. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [isMuted, voiceAssistant, toast]
  );

  const processCommand = async (command: string): Promise<string> => {
    console.log("Processing command:", command);

    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes("hello") || lowerCommand.includes("hi")) {
      return "Hello! Welcome to MuseRoom! I'm here to help you with Discord messages and summaries. What would you like me to do?";
    }

    if (
      lowerCommand.includes("discord") &&
      (lowerCommand.includes("read") || lowerCommand.includes("messages"))
    ) {
      return await handleDiscordCommand(command);
    }

    if (lowerCommand.includes("help")) {
      return "I can help you read Discord messages and create summaries. Try saying 'Read latest Discord messages' or 'Show Discord summary'.";
    }

    return (
      "I understand you said: " +
      command +
      ". I'm specialized in helping with Discord messages. Try asking me to read Discord messages or create summaries."
    );
  };

  const handleDiscordCommand = async (command: string): Promise<string> => {
    try {
      // This would integrate with your Discord API
      // For now, return a mock response
      return "I would fetch the latest Discord messages for you. This feature is being implemented to connect with your Discord channels and provide message summaries.";
    } catch (error) {
      console.error("Discord command error:", error);
      return "I'm sorry, I couldn't fetch the Discord messages right now. Please check your connection and try again.";
    }
  };

  const toggleListening = () => {
    if (speechRecognition.isListening) {
      speechRecognition.stopListening();
      voiceAssistant.stop();
    } else {
      speechRecognition.startListening();
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      voiceAssistant.interruptSpeak();
    }
  };

  const toggleVoiceEnabled = () => {
    setIsVoiceEnabled(!isVoiceEnabled);
    if (isVoiceEnabled) {
      voiceAssistant.stop();
      speechRecognition.stopListening();
    }
  };

  const getStatusColor = () => {
    switch (speechRecognition.status) {
      case RecognitionStatus.LISTENING:
        return "text-green-500";
      case RecognitionStatus.PROCESSING:
        return "text-blue-500";
      case RecognitionStatus.ERROR:
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const getConfidenceColor = () => {
    switch (speechRecognition.confidence) {
      case TranscriptConfidence.HIGH:
        return "text-green-500";
      case TranscriptConfidence.MEDIUM:
        return "text-yellow-500";
      case TranscriptConfidence.LOW:
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  // Expose the toggle function globally so the GIF can trigger it
  React.useEffect(() => {
    (window as any).toggleVoiceListening = toggleListening;
    return () => {
      delete (window as any).toggleVoiceListening;
    };
  }, [toggleListening]);

  // Update the main GIF's visual state based on voice status
  React.useEffect(() => {
    const indicator = document.getElementById("voice-listening-indicator");
    const statusText = document.getElementById("voice-status-text");

    if (indicator && statusText) {
      if (speechRecognition.isListening) {
        indicator.style.display = "block";
        statusText.textContent = "🎤 Listening... Click again to stop";
        statusText.className = "text-sm text-green-600 font-medium";
      } else if (isProcessing) {
        indicator.style.display = "none";
        statusText.textContent = "⚡ Processing your request...";
        statusText.className = "text-sm text-blue-600 font-medium";
      } else {
        indicator.style.display = "none";
        statusText.textContent =
          "Voice assistant ready - Click the animation above to start";
        statusText.className = "text-sm text-muted-foreground/70 font-medium";
      }
    }
  }, [speechRecognition.isListening, isProcessing]);

  // Connect audio levels to GIF animation speed and pulse
  React.useEffect(() => {
    const gif = document.getElementById("ai-assistant-gif");
    const ring1 = document.getElementById("audio-ring-1");
    const ring2 = document.getElementById("audio-ring-2");
    const ring3 = document.getElementById("audio-ring-3");

    if (!gif) return;

    let userAnimationFrame: number;
    let aiAnimationFrame: number;
    let userAudioContext: AudioContext | null = null;
    let userAnalyser: AnalyserNode | null = null;
    let userMicrophone: MediaStreamAudioSourceNode | null = null;
    let userDataArray: Uint8Array | null = null;

    // User input visualization (pulse effects)
    const startUserAudioVisualization = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        userAudioContext = new AudioContext();
        userMicrophone = userAudioContext.createMediaStreamSource(stream);
        userAnalyser = userAudioContext.createAnalyser();

        userAnalyser.fftSize = 256;
        userAnalyser.smoothingTimeConstant = 0.3;
        userDataArray = new Uint8Array(userAnalyser.frequencyBinCount);

        userMicrophone.connect(userAnalyser);

        const updateUserPulse = () => {
          if (!userAnalyser || !userDataArray || !gif) return;

          userAnalyser.getByteFrequencyData(userDataArray);

          // Calculate average audio level for user input
          let sum = 0;
          for (let i = 0; i < userDataArray.length; i++) {
            sum += userDataArray[i];
          }
          const average = sum / userDataArray.length;
          const normalizedLevel = Math.min(average / 128, 1); // Normalize to 0-1

          // Control pulse intensity with CSS custom properties
          const pulseIntensity = Math.max(normalizedLevel * 2, 0.2); // Minimum pulse
          const pulseSpeed = Math.max(2 - normalizedLevel * 1.5, 0.3); // Faster pulse with more audio

          gif.style.setProperty(
            "--user-pulse-intensity",
            pulseIntensity.toString()
          );
          gif.style.setProperty("--user-pulse-speed", `${pulseSpeed}s`);

          // Update audio level rings for user input
          if (ring1 && ring2 && ring3) {
            const opacity1 = Math.min(normalizedLevel * 2, 1);
            const opacity2 = Math.min((normalizedLevel - 0.2) * 2.5, 1);
            const opacity3 = Math.min((normalizedLevel - 0.4) * 3, 1);

            ring1.style.borderColor = `rgba(34, 197, 94, ${opacity1})`; // Green for user input
            ring2.style.borderColor = `rgba(59, 130, 246, ${Math.max(
              opacity2,
              0
            )})`;
            ring3.style.borderColor = `rgba(6, 182, 212, ${Math.max(
              opacity3,
              0
            )})`;
          }

          userAnimationFrame = requestAnimationFrame(updateUserPulse);
        };

        updateUserPulse();
      } catch (error) {
        console.error(
          "Error accessing microphone for user input visualization:",
          error
        );
      }
    };

    const stopUserAudioVisualization = () => {
      if (userAnimationFrame) {
        cancelAnimationFrame(userAnimationFrame);
      }
      if (userMicrophone) {
        userMicrophone.disconnect();
      }
      if (userAudioContext) {
        userAudioContext.close();
      }

      // Reset user pulse effects
      gif.style.removeProperty("--user-pulse-intensity");
      gif.style.removeProperty("--user-pulse-speed");

      // Reset rings
      if (ring1 && ring2 && ring3) {
        ring1.style.borderColor = "rgba(34, 197, 94, 0)";
        ring2.style.borderColor = "rgba(59, 130, 246, 0)";
        ring3.style.borderColor = "rgba(6, 182, 212, 0)";
      }
    };

    // AI response visualization (speed effects)
    const monitorAIAudio = () => {
      // Check if AI is speaking and adjust animation speed accordingly
      const updateAISpeed = () => {
        // Remove all existing speed classes
        gif.classList.remove(
          "ai-assistant-gif-idle",
          "ai-assistant-gif-slow",
          "ai-assistant-gif-normal",
          "ai-assistant-gif-fast",
          "ai-assistant-gif-intense",
          "ai-assistant-gif-speaking"
        );

        if (voiceAssistant.isSpeaking()) {
          // AI is speaking - use speaking animation
          gif.classList.add("ai-assistant-gif-speaking");

          // Add orange/red rings for AI output
          if (ring1 && ring2 && ring3) {
            ring1.style.borderColor = "rgba(251, 146, 60, 0.8)"; // Orange for AI output
            ring2.style.borderColor = "rgba(239, 68, 68, 0.6)"; // Red for AI output
            ring3.style.borderColor = "rgba(168, 85, 247, 0.4)"; // Purple for AI output
          }
        } else if (isProcessing) {
          // AI is processing - use normal speed
          gif.classList.add("ai-assistant-gif-normal");
        } else if (speechRecognition.isListening) {
          // User can speak - use slow baseline
          gif.classList.add("ai-assistant-gif-slow");
        } else {
          // Completely idle - use idle animation
          gif.classList.add("ai-assistant-gif-idle");
        }

        aiAnimationFrame = requestAnimationFrame(updateAISpeed);
      };

      updateAISpeed();
    };

    const stopAIVisualization = () => {
      if (aiAnimationFrame) {
        cancelAnimationFrame(aiAnimationFrame);
      }

      // Reset to idle state
      const gif = document.getElementById("ai-assistant-gif");
      if (gif) {
        gif.classList.remove(
          "ai-assistant-gif-slow",
          "ai-assistant-gif-normal",
          "ai-assistant-gif-fast",
          "ai-assistant-gif-intense",
          "ai-assistant-gif-speaking"
        );
        gif.classList.add("ai-assistant-gif-idle");
      }
    };

    // Start appropriate visualizations
    if (speechRecognition.isListening) {
      startUserAudioVisualization(); // Start user input visualization
    } else {
      stopUserAudioVisualization();
    }

    // Always monitor AI state
    monitorAIAudio();

    return () => {
      stopUserAudioVisualization();
      stopAIVisualization();
    };
  }, [speechRecognition.isListening, isProcessing, voiceAssistant]);

  return (
    <div className="space-y-6">
      {/* Status Information Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-6">
              <span className={`font-medium ${getStatusColor()}`}>
                Status: {speechRecognition.status}
              </span>
              {speechRecognition.confidence && (
                <span className={`font-medium ${getConfidenceColor()}`}>
                  Confidence: {speechRecognition.confidence}
                </span>
              )}
              <span className="text-gray-500">
                {useElevenLabs
                  ? `Voice: ${selectedVoice}`
                  : "Voice: Browser Default"}
              </span>
            </div>

            {speechRecognition.isMicrophoneAvailable === false && (
              <span className="text-red-500 font-medium flex items-center">
                🎤 Microphone not available
              </span>
            )}
          </div>

          {/* Current Transcript */}
          {(currentTranscript || speechRecognition.transcript) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
            >
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>🎤 Listening:</strong>{" "}
                {currentTranscript || speechRecognition.transcript}
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* GIF Waveform Info */}
      <Card>
        <CardContent className="p-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              🎨 GIF Audio Visualization
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The AI assistant animation above responds to your voice - watch it
              pulse and change speed based on your audio levels!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Control Panel */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center space-x-4">
            {/* Processing Indicator */}
            {isProcessing && (
              <div className="flex items-center space-x-2 text-blue-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">Processing...</span>
              </div>
            )}

            {/* Manual Voice Toggle Button */}
            <Button
              onClick={toggleListening}
              variant={
                speechRecognition.isListening ? "destructive" : "default"
              }
              size="sm"
              className="shadow-sm"
              disabled={!speechRecognition.browserSupportsSpeechRecognition}
            >
              {speechRecognition.isListening
                ? "Stop Listening"
                : "Start Listening"}
            </Button>

            {/* Mute Button */}
            <Button
              onClick={toggleMute}
              variant={isMuted ? "destructive" : "outline"}
              size="sm"
              className="shadow-sm"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
              <span className="ml-2 text-xs">
                {isMuted ? "Unmute" : "Mute"}
              </span>
            </Button>

            {/* Voice Toggle */}
            <Button
              onClick={toggleVoiceEnabled}
              variant={isVoiceEnabled ? "default" : "outline"}
              size="sm"
              className="shadow-sm"
            >
              <Settings className="h-4 w-4" />
              <span className="ml-2 text-xs">Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card className="flex-1">
        <CardContent className="p-0">
          <div className="h-96 overflow-y-auto p-4 space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`flex ${
                    message.isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-3 rounded-xl shadow-sm ${
                      message.isUser
                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                        : "bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{message.text}</p>
                    <p className="text-xs mt-2 opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-xs text-gray-500 space-y-1">
        <div>
          {speechRecognition.browserSupportsSpeechRecognition
            ? "🎤 Voice recognition enabled • 🔊 ElevenLabs TTS ready • 🎨 GIF waveform active"
            : "❌ Voice recognition not supported in this browser"}
        </div>
        <div className="text-blue-600 dark:text-blue-400 font-medium">
          Click the AI assistant animation above to activate voice controls
        </div>
      </div>
    </div>
  );
}
