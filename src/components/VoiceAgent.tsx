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
  initialPrompt?: string | null;
  onPromptHandled?: () => void;
  showChat?: boolean;
  setShowChat?: (show: boolean) => void;
}

export function VoiceAgent({
  selectedVoice,
  useElevenLabs,
  availableVoices,
  elevenLabsApiKey,
  initialPrompt,
  onPromptHandled,
  showChat = true,
  setShowChat,
}: VoiceAgentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [textInput, setTextInput] = useState("");

  const { toast } = useToast();

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
    waveformCanvas: null, // Disabled for performance - using simple GIF speed changes instead
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

  // Generate time-based greeting
  const generateWelcomeGreeting = () => {
    const now = new Date();
    const hour = now.getHours();
    const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
    const monthDay = now.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });

    let timeGreeting = "";
    if (hour < 12) {
      timeGreeting = "Good morning";
    } else if (hour < 17) {
      timeGreeting = "Good afternoon";
    } else {
      timeGreeting = "Good evening";
    }

    const capabilities = [
      "managing your Discord messages and summaries",
      "helping with page navigation and app control",
      "adding notes to Notion and managing tasks",
      "analyzing conversations and providing insights",
      "controlling project settings and workflows",
      "answering questions and providing assistance",
    ];

    const randomCapability =
      capabilities[Math.floor(Math.random() * capabilities.length)];

    return `${timeGreeting}! Welcome to MuseRoom Dashboard. Today is ${dayName}, ${monthDay}. I'm your unified AI assistant, ready to help with ${randomCapability}. You can speak to me directly or type your questions - I understand both voice and text commands.`;
  };

  // Only run this effect on mount and when initialPrompt changes
  useEffect(() => {
    if (initialPrompt) {
      // If there is an initial prompt, add only the user message and process it
      const userMessage: Message = {
        id: Date.now().toString(),
        text: initialPrompt,
        timestamp: new Date(),
        isUser: true,
      };
      setMessages([userMessage]);
      setCurrentTranscript("");
      setIsProcessing(true);
      processCommand(initialPrompt).then((response) => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: response,
          timestamp: new Date(),
          isUser: false,
        };
        setMessages((prev) => [...prev, aiMessage]);
        setIsProcessing(false);
        if (!isMuted && voiceAssistant && voiceAssistant.speak) {
          voiceAssistant.speak(response);
        }
        if (onPromptHandled) onPromptHandled();
      });
    } else {
      // If there is no initial prompt, show the greeting only
      const welcomeText = generateWelcomeGreeting();
      const welcomeMessage: Message = {
        id: "welcome",
        text: welcomeText,
        timestamp: new Date(),
        isUser: false,
      };
      setMessages([welcomeMessage]);
      // Speak the welcome message after a short delay to ensure everything is loaded
      const speakWelcome = async () => {
        await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 second delay
        if (!isMuted && voiceAssistant && voiceAssistant.speak) {
          try {
            await voiceAssistant.speak(welcomeText);
          } catch (error) {
            console.error("Error speaking welcome message:", error);
          }
        }
      };
      speakWelcome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

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

  // Handle text input submission
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    await processUserInput(textInput.trim());
    setTextInput("");
  };

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

    // Greeting responses
    if (lowerCommand.includes("hello") || lowerCommand.includes("hi")) {
      return "Hello! I'm your AI assistant for MuseRoom. I can help with Discord messages, page navigation, Notion tasks, project management, and much more. What would you like me to help you with?";
    }

    // Discord-related commands
    if (
      lowerCommand.includes("discord") &&
      (lowerCommand.includes("read") || lowerCommand.includes("messages"))
    ) {
      return await handleDiscordCommand(command);
    }

    // Navigation commands
    if (
      lowerCommand.includes("navigate") ||
      lowerCommand.includes("go to") ||
      lowerCommand.includes("show")
    ) {
      if (
        lowerCommand.includes("discord") ||
        lowerCommand.includes("messages")
      ) {
        return "I'll navigate you to the Discord messages tab to view your latest messages and summaries.";
      }
      if (
        lowerCommand.includes("notion") ||
        lowerCommand.includes("workspace") ||
        lowerCommand.includes("notes") ||
        lowerCommand.includes("tasks")
      ) {
        return "I'll navigate you to the Notion workspace where you can manage your notes, tasks, and projects.";
      }
      return "I can help you navigate to different sections of the dashboard. Try saying 'show discord messages', 'show notion workspace', or 'go to settings'.";
    }

    // Notion integration
    if (
      lowerCommand.includes("notion") ||
      lowerCommand.includes("note") ||
      lowerCommand.includes("task")
    ) {
      return "I can help you access your company's Notion workspace! You can configure your workspace URL in the Notion tab, and I'll provide quick links to all your team pages. Say 'show notion workspace' to get started.";
    }

    // Help and capabilities
    if (
      lowerCommand.includes("help") ||
      lowerCommand.includes("what can you do")
    ) {
      return "I'm your unified AI assistant! I can help with: Discord message management and summaries, Notion workspace for notes and tasks, page navigation, project management, answering questions, and general assistance. Try saying 'show discord messages', 'show notion workspace', or ask me any question!";
    }

    // Project management
    if (
      lowerCommand.includes("project") ||
      lowerCommand.includes("manage") ||
      lowerCommand.includes("organize")
    ) {
      return "I can help you manage your projects and workflow. I can assist with organizing tasks, tracking progress, and connecting with your project management tools.";
    }

    // General AI assistance
    if (
      lowerCommand.includes("analyze") ||
      lowerCommand.includes("summarize") ||
      lowerCommand.includes("explain")
    ) {
      return "I can analyze and summarize content for you. Whether it's Discord conversations, project updates, or general information, I'm here to help break it down and provide insights.";
    }

    // Default response - more comprehensive than before
    return `I heard you say: "${command}". I'm your unified AI assistant and I can help with Discord messages, Notion workspace, page navigation, project management, and much more. Try asking me to "show Discord messages", "show notion workspace", or "what can you do?" to get started.`;
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

  // Add debouncing to prevent rapid clicking
  const lastToggleRef = React.useRef(0);

  const toggleListening = useCallback(() => {
    const now = Date.now();

    if (now - lastToggleRef.current < 1000) {
      // Less than 1 second since last toggle, ignore
      console.log("Toggle ignored due to debouncing");
      return;
    }

    lastToggleRef.current = now;

    if (speechRecognition.isListening) {
      speechRecognition.stopListening();
      voiceAssistant.stop();
      setIsVoiceEnabled(false);
    } else {
      // Enable voice assistant if not already enabled
      if (!isVoiceEnabled) {
        setIsVoiceEnabled(true);
      }

      // Clear any previous error messages when starting
      if (speechRecognition.errorMessage) {
        console.log("Clearing previous error message and retrying");
      }
      speechRecognition.startListening();
    }
  }, [speechRecognition, voiceAssistant, isVoiceEnabled]);

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

  // Create a function to manually trigger welcome greeting
  const triggerWelcomeGreeting = React.useCallback(async () => {
    const welcomeText = generateWelcomeGreeting();
    console.log("Manually triggering welcome greeting:", welcomeText);

    if (!isMuted && voiceAssistant && voiceAssistant.speak) {
      try {
        await voiceAssistant.speak(welcomeText);
      } catch (error) {
        console.error("Error speaking manual welcome message:", error);
      }
    }
  }, [isMuted, voiceAssistant]);

  // Expose functions globally so the GIF and console can trigger them
  React.useEffect(() => {
    (window as any).toggleVoiceListening = toggleListening;
    (window as any).speakWelcome = triggerWelcomeGreeting;
    return () => {
      delete (window as any).toggleVoiceListening;
      delete (window as any).speakWelcome;
    };
  }, [toggleListening, triggerWelcomeGreeting]);

  // Update the main GIF's visual state based on voice status (outline only)
  React.useEffect(() => {
    const container = document.querySelector(".ai-assistant-container");

    if (container) {
      if (speechRecognition.isListening) {
        // Add listening state class for green outline effect
        container.classList.add("listening-active");
        container.classList.remove("speaking-active");
      } else {
        // Remove listening state class
        container.classList.remove("listening-active");
      }
    }
  }, [speechRecognition.isListening]);

  // Update the main GIF's visual state for speaking (purple pulse effect)
  React.useEffect(() => {
    const container = document.querySelector(".ai-assistant-container");

    if (container) {
      if (voiceAssistant.isSpeaking()) {
        // Add speaking state class for purple pulse effect
        container.classList.add("speaking-active");
        container.classList.remove("listening-active");
      } else {
        // Remove speaking state class
        container.classList.remove("speaking-active");
      }
    }
  }, [voiceAssistant.isSpeaking()]);

  // Efficient GIF animation state management (no infinite loops)
  React.useEffect(() => {
    const gif = document.getElementById("ai-assistant-gif");
    if (!gif) return;

    // Remove all existing speed classes
    gif.classList.remove(
      "ai-assistant-gif-idle",
      "ai-assistant-gif-slow",
      "ai-assistant-gif-normal",
      "ai-assistant-gif-fast",
      "ai-assistant-gif-intense",
      "ai-assistant-gif-speaking"
    );

    // Apply the correct class based on current state (no animation frames needed)
    if (voiceAssistant.isSpeaking()) {
      gif.classList.add("ai-assistant-gif-speaking");
    } else if (isProcessing) {
      gif.classList.add("ai-assistant-gif-normal");
    } else if (speechRecognition.isListening) {
      gif.classList.add("ai-assistant-gif-slow");
    } else {
      gif.classList.add("ai-assistant-gif-idle");
    }

    // No cleanup needed - just a simple class update
  }, [speechRecognition.isListening, isProcessing, voiceAssistant.isSpeaking]);

  return (
    <>
      {/* Only render chat UI if showChat is true */}
      {showChat && (
        <div className="card-modern bg-gradient-to-br from-purple-900/30 via-[#232136]/80 to-pink-900/30 border border-purple-500/40 rounded-2xl shadow-2xl backdrop-blur-xl p-0 w-full max-w-2xl mx-auto">
          {/* Status Header */}
          {(speechRecognition.isListening || isProcessing) && (
            <div className="mb-6 flex items-center justify-center">
              <div
                className="flex items-center space-x-3 bg-gray-800/60 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-600/40"
                role="status"
                aria-live="polite"
                aria-label={
                  speechRecognition.isListening
                    ? "Voice assistant is listening"
                    : "Voice assistant is processing"
                }
              >
                {speechRecognition.isListening && (
                  <>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                    <span className="text-green-400 text-sm">Listening...</span>
                  </>
                )}
                {isProcessing && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    <span className="text-blue-400 text-sm">Processing...</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Messages Container */}
          <div
            className="h-80 overflow-y-auto p-6 space-y-4 custom-scrollbar mb-6"
            role="log"
            aria-label="Conversation messages"
            aria-live="polite"
          >
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className={`flex ${
                    message.isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-5 py-3 rounded-2xl shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 ${
                      message.isUser
                        ? "bg-gradient-to-br from-blue-600 to-purple-700 text-white border border-blue-400/50"
                        : "bg-gradient-to-br from-gray-700/95 to-gray-800/95 text-gray-100 border border-gray-600/50"
                    }`}
                  >
                    {!message.isUser && (
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                        <span className="text-xs font-medium text-purple-400">
                          Assistant
                        </span>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed">{message.text}</p>
                    <div className="flex justify-between items-center mt-3">
                      <p className="text-xs opacity-60">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {message.isUser && (
                        <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator when processing */}
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="bg-gradient-to-br from-gray-700/95 to-gray-800/95 border border-gray-600/50 rounded-2xl px-5 py-3 backdrop-blur-sm">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                    <span className="text-xs text-purple-400">
                      Assistant is thinking...
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Text Input Area */}
          <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4">
            <form onSubmit={handleTextSubmit} className="space-y-3">
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type a message or click the animation above for voice :)"
                  className="flex-1 bg-gray-800/80 border border-gray-600/40 rounded-xl px-4 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400/50 focus:bg-gray-800 backdrop-blur-sm transition-all duration-200"
                  disabled={isProcessing}
                  aria-label="Type your message"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isProcessing}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105"
                  aria-label="Send message"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
