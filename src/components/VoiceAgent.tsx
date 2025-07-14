import React, { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import {
  Loader2,
  WifiOff,
  AlertTriangle,
  LayoutDashboard,
} from "lucide-react";
import { useToast } from "./ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAIAssistant } from "../hooks/useAIAssistant";
import useDirectSpeechRecognition from "../../useDirectSpeechRecognition";

interface Message {
  id: string;
  text: string;
  timestamp: Date;
  isUser: boolean;
  intent?: string;
  intentConfidence?: number;
  source?: "gemini" | "notion" | "discord" | "calendar" | "system";
}

interface VoiceAgentProps {
  selectedVoice: string;
  useElevenLabs: boolean;
  elevenLabsApiKey: string;
  initialPrompt?: string | null;
  onPromptHandled?: () => void;
  showChat?: boolean;
}

export function VoiceAgent({
  selectedVoice,
  useElevenLabs,
  elevenLabsApiKey,
  initialPrompt,
  onPromptHandled,
  showChat = true,
}: VoiceAgentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  // Setter is intentionally unused – rename with underscore to avoid TS6133
  const [isMuted, _setIsMuted] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [lastIntent, setLastIntent] = useState<
    "notion" | "discord" | "calendar" | "general" | null
  >(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState("");
  const [workspaceOverviewShown, setWorkspaceOverviewShown] = useState(false);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  // Removed standalone GeminiService ref – useAIAssistant handles this centrally

  // Helper to generate a collision-resistant ID for React keys
  const generateMessageId = useCallback(
    () => Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
    []
  );

  const { toast } = useToast();

  // Use the sophisticated direct speech recognition hook
  const speechRecognition = useDirectSpeechRecognition();

  // Use the AI assistant hook with Gemini, Notion, and ElevenLabs integration
  const aiAssistant = useAIAssistant({
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
    notionApiKey: import.meta.env.VITE_NOTION_API_KEY,
    elevenLabsApiKey: useElevenLabs ? elevenLabsApiKey : "",
    selectedVoice: selectedVoice,
    useElevenLabs: useElevenLabs,
    systemInstruction: `You are an AI assistant integrated into the MuseRoom Dashboard.

You ALREADY have fully authenticated access (via secure backend services) to:
• The user's Notion workspace
• The user's Discord server/channels
• The user's Google Calendar

All required API keys and credentials are managed by the system—never ask the user
to provide authentication tokens, API keys, or any credentials.

Be helpful, concise, and friendly while assisting with tasks such as creating,
reading, updating, or searching Notion pages/databases, interacting with Discord
messages/channels, and managing Google Calendar events.`,
    onError: (error) => {
      console.error("AI Assistant Error:", error);

      // Check if it's an API key related error
      const errorMessage = error.message.toLowerCase();
      if (
        errorMessage.includes("api key expired") ||
        errorMessage.includes("invalid api key") ||
        errorMessage.includes("quota") ||
        errorMessage.includes("rate limit")
      ) {
        // Update offline mode state
        setIsOfflineMode(true);

        // Set a user-friendly error message
        if (
          errorMessage.includes("api key expired") ||
          errorMessage.includes("invalid api key")
        ) {
          setApiErrorMessage(
            "The Gemini API key has expired. Please contact the administrator to renew it."
          );
        } else if (
          errorMessage.includes("quota") ||
          errorMessage.includes("rate limit")
        ) {
          setApiErrorMessage(
            "The Gemini API quota has been exceeded. Please try again later."
          );
        } else {
          setApiErrorMessage(
            "There was an issue connecting to the Gemini API. Using offline mode for now."
          );
        }

        // Show toast notification
        toast({
          title: "Switching to Offline Mode",
          description:
            apiErrorMessage ||
            "API connection issue detected. Using offline mode.",
          variant: "default",
          duration: 6000,
        });
      } else {
        // For other errors, show standard error toast
        toast({
          title: "AI Assistant Error",
          description: error.message,
          variant: "destructive",
        });
      }
    },
    onIntentDetected: (intent, confidence, action) => {
      console.log(
        `Intent detected: ${intent} (${confidence}) - Action: ${action}`
      );
      setLastIntent(intent as "notion" | "discord" | "calendar" | "general");
    },
  });

  // Sync offline mode state with assistant hook
  useEffect(() => {
    setIsOfflineMode(aiAssistant.isOfflineMode);
    setApiErrorMessage(aiAssistant.apiErrorMessage);
  }, [aiAssistant.isOfflineMode, aiAssistant.apiErrorMessage]);

  // Handle user speech transcript
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

    let greeting = `${timeGreeting}! Welcome to MuseRoom Dashboard. Today is ${dayName}, ${monthDay}. I'm your unified AI assistant, ready to help with ${randomCapability}. You can speak to me directly or type your questions - I understand both voice and text commands.`;

    // Add offline mode notification if needed
    if (isOfflineMode) {
      greeting += ` (Note: I'm currently operating in offline mode. Some advanced features may be limited.)`;
    }

    return greeting;
  };

  // Function to get workspace overview
  const getWorkspaceOverview = useCallback(async () => {
    if (workspaceOverviewShown) return; // Don't fetch again if already shown

    setIsLoadingWorkspace(true);
    try {
      // Send a special message to trigger workspace overview
      const response = await aiAssistant.sendMessage("workspace overview");

      // Create a system message with the workspace overview
      const overviewMessage: Message = {
        id: generateMessageId(),
        text: response,
        timestamp: new Date(),
        isUser: false,
        source: "system",
      };

      // Add the overview message to the conversation
      setMessages((prev) => {
        // If it's the first message, just set it
        if (prev.length === 0) return [overviewMessage];
        // Otherwise, add it as the second message (after welcome)
        return [prev[0], overviewMessage, ...prev.slice(1)];
      });

      // Mark workspace overview as shown
      setWorkspaceOverviewShown(true);

      // Speak the overview if not muted
      if (!isMuted && useElevenLabs) {
        await aiAssistant.speakMessage(response);
      }
    } catch (error) {
      console.error("Error fetching workspace overview:", error);
      toast({
        title: "Workspace Overview Error",
        description:
          "Could not fetch workspace overview. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingWorkspace(false);
    }
  }, [
    workspaceOverviewShown,
    aiAssistant,
    generateMessageId,
    isMuted,
    useElevenLabs,
    toast,
  ]);

  // Only run this effect on mount and when initialPrompt changes
  useEffect(() => {
    if (initialPrompt) {
      // If there is an initial prompt, add only the user message and process it
      const userMessage: Message = {
        id: generateMessageId(),
        text: initialPrompt,
        timestamp: new Date(),
        isUser: true,
      };

      // Add user message to conversation
      setMessages((prev) => [...prev, userMessage]);
      setIsProcessing(true);

      // Process with AI Assistant - using a standard user message approach
      // instead of trying to use system instructions which cause errors
      processUserInput(initialPrompt);

      // Notify parent component that prompt was handled
      if (onPromptHandled) onPromptHandled();
    } else {
      // If there is no initial prompt, show the greeting only WITHOUT calling the AI API
      const welcomeText = generateWelcomeGreeting();
      const welcomeMessage: Message = {
        id: "welcome",
        text: welcomeText,
        timestamp: new Date(),
        isUser: false,
        source: "system", // Mark as coming from system without API call
      };

      // Just set the welcome message directly without AI processing
      setMessages([welcomeMessage]);

      // Speak the welcome message after a short delay using direct speech synthesis
      // to avoid triggering Gemini API calls for the welcome message
      const speakWelcome = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
        if (!isMuted) {
          try {
            // Use direct speech synthesis without going through AI pipeline
            if (useElevenLabs && elevenLabsApiKey) {
              // Use ElevenLabs directly for the welcome message
              const audio = new Audio();
              const response = await axios.post(
                `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`,
                {
                  text: welcomeText,
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

              const blob = new Blob([response.data], { type: "audio/mpeg" });
              const url = URL.createObjectURL(blob);
              audio.src = url;
              await audio.play();

              audio.onended = () => {
                URL.revokeObjectURL(url);
              };
            } else {
              // Fallback to browser's text-to-speech
              const utterance = new SpeechSynthesisUtterance(welcomeText);
              window.speechSynthesis.speak(utterance);
            }
          } catch (error) {
            console.error("Error speaking welcome message:", error);
            // Fallback to browser's text-to-speech
            const utterance = new SpeechSynthesisUtterance(welcomeText);
            window.speechSynthesis.speak(utterance);
          }
        }

        // After welcome message, fetch workspace overview
        setTimeout(() => {
          getWorkspaceOverview();
        }, 2000); // Wait 2 seconds after welcome message before showing workspace overview
      };
      speakWelcome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, isOfflineMode]);

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
        id: generateMessageId(),
        text: userInput,
        timestamp: new Date(),
        isUser: true,
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        // Detect intent for visual indicator
        let intentResult;
        try {
          intentResult = await aiAssistant.detectIntent(userInput);
          setLastIntent(intentResult.intent);
        } catch (intentError) {
          console.warn("Intent detection failed, using fallback:", intentError);

          // Check if it's an API key issue
          const errorMessage =
            intentError instanceof Error
              ? intentError.message.toLowerCase()
              : "";
          if (
            errorMessage.includes("api key expired") ||
            errorMessage.includes("invalid api key") ||
            errorMessage.includes("quota") ||
            errorMessage.includes("rate limit")
          ) {
            setIsOfflineMode(true);

            if (
              errorMessage.includes("api key expired") ||
              errorMessage.includes("invalid api key")
            ) {
              setApiErrorMessage(
                "The Gemini API key has expired. Please contact the administrator to renew it."
              );
            } else if (
              errorMessage.includes("quota") ||
              errorMessage.includes("rate limit")
            ) {
              setApiErrorMessage(
                "The Gemini API quota has been exceeded. Please try again later."
              );
            }
          }

          intentResult = { intent: "general", confidence: 0.5 };
          setLastIntent("general");
        }

        // Process with AI Assistant
        let response;
        try {
          response = await aiAssistant.sendMessage(userInput);

          // Check if response indicates offline mode
          if (
            response.includes("offline mode") ||
            response.includes("API key")
          ) {
            setIsOfflineMode(true);

            // Extract error message if present
            if (response.includes("API key has expired")) {
              setApiErrorMessage(
                "The Gemini API key has expired. Please contact the administrator to renew it."
              );
            } else if (response.includes("quota has been exceeded")) {
              setApiErrorMessage(
                "The Gemini API quota has been exceeded. Please try again later."
              );
            } else {
              setApiErrorMessage(
                "Using offline mode due to API connection issues."
              );
            }
          }
        } catch (err) {
          console.error("Error from AI service:", err);

          // Check if it's an API key issue
          const errorMessage =
            err instanceof Error ? err.message.toLowerCase() : "";
          if (
            errorMessage.includes("api key expired") ||
            errorMessage.includes("invalid api key") ||
            errorMessage.includes("quota") ||
            errorMessage.includes("rate limit")
          ) {
            setIsOfflineMode(true);

            if (
              errorMessage.includes("api key expired") ||
              errorMessage.includes("invalid api key")
            ) {
              setApiErrorMessage(
                "The Gemini API key has expired. Please contact the administrator to renew it."
              );
              response = `I'm currently operating in offline mode. The Gemini API key has expired. Please contact the administrator to renew it. I'll still try to help with basic information about Notion, Discord, and Google Calendar.`;
            } else if (
              errorMessage.includes("quota") ||
              errorMessage.includes("rate limit")
            ) {
              setApiErrorMessage(
                "The Gemini API quota has been exceeded. Please try again later."
              );
              response = `I'm currently operating in offline mode. The Gemini API quota has been exceeded. Please try again later. I'll still try to help with basic information about Notion, Discord, and Google Calendar.`;
            } else {
              setApiErrorMessage(
                "There was an issue connecting to the Gemini API."
              );
              response =
                "I'm sorry, I encountered an issue processing your request. I'm currently operating in offline mode with limited capabilities.";
            }
          } else {
            response =
              "I'm sorry, I encountered an issue processing your request. Please try again.";
          }
        }

        const aiMessage: Message = {
          id: generateMessageId(),
          text: response,
          timestamp: new Date(),
          isUser: false,
          intent: intentResult.intent,
          intentConfidence: intentResult.confidence,
          source: intentResult.intent === "notion" ? "notion" : "gemini",
        };

        setMessages((prev) => [...prev, aiMessage]);
        // Speak the response
        if (!isMuted && response) {
          await aiAssistant.speakMessage(response);
        }
      } catch (error) {
        console.error("Error processing user input:", error);

        // Check if it's an API key issue
        const errorMessage =
          error instanceof Error ? error.message.toLowerCase() : "";
        let responseText =
          "I'm sorry, I encountered an error processing your request. Please try again.";

        if (
          errorMessage.includes("api key expired") ||
          errorMessage.includes("invalid api key") ||
          errorMessage.includes("quota") ||
          errorMessage.includes("rate limit")
        ) {
          setIsOfflineMode(true);

          if (
            errorMessage.includes("api key expired") ||
            errorMessage.includes("invalid api key")
          ) {
            setApiErrorMessage(
              "The Gemini API key has expired. Please contact the administrator to renew it."
            );
            responseText = `I'm currently operating in offline mode. The Gemini API key has expired. Please contact the administrator to renew it. I'll still try to help with basic information about Notion, Discord, and Google Calendar.`;
          } else if (
            errorMessage.includes("quota") ||
            errorMessage.includes("rate limit")
          ) {
            setApiErrorMessage(
              "The Gemini API quota has been exceeded. Please try again later."
            );
            responseText = `I'm currently operating in offline mode. The Gemini API quota has been exceeded. Please try again later. I'll still try to help with basic information about Notion, Discord, and Google Calendar.`;
          } else {
            setApiErrorMessage(
              "There was an issue connecting to the Gemini API."
            );
            responseText =
              "I'm sorry, I encountered an issue processing your request. I'm currently operating in offline mode with limited capabilities.";
          }
        }

        const aiMessage: Message = {
          id: generateMessageId(),
          text: responseText,
          timestamp: new Date(),
          isUser: false,
        };

        setMessages((prev) => [...prev, aiMessage]);

        if (!isMuted) {
          await aiAssistant.speakMessage(responseText);
        }

        toast({
          title: isOfflineMode ? "Offline Mode Active" : "Processing Error",
          description: isOfflineMode
            ? apiErrorMessage ||
              "Using offline mode due to API connection issues."
            : "Failed to process your request. Please try again.",
          variant: isOfflineMode ? "default" : "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [
      isMuted,
      aiAssistant,
      toast,
      isOfflineMode,
      apiErrorMessage,
      generateMessageId,
    ]
  );

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
      aiAssistant.stopSpeaking();
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
  }, [speechRecognition, aiAssistant, isVoiceEnabled]);

  /* --- Muting & voice-enable toggles removed because they were unused --- */

  // Create a function to manually trigger welcome greeting
  const triggerWelcomeGreeting = React.useCallback(async () => {
    const welcomeText = generateWelcomeGreeting();
    console.log("Manually triggering welcome greeting:", welcomeText);

    if (!isMuted) {
      try {
        // Use direct speech synthesis to avoid Gemini API calls
        if (useElevenLabs && elevenLabsApiKey) {
          const audio = new Audio();
          const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`,
            {
              text: welcomeText,
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

          const blob = new Blob([response.data], { type: "audio/mpeg" });
          const url = URL.createObjectURL(blob);
          audio.src = url;
          await audio.play();

          audio.onended = () => {
            URL.revokeObjectURL(url);
          };
        } else {
          // Fallback to browser's text-to-speech
          const utterance = new SpeechSynthesisUtterance(welcomeText);
          window.speechSynthesis.speak(utterance);
        }
      } catch (error) {
        console.error("Error speaking manual welcome message:", error);
        // Fallback to browser's text-to-speech
        const utterance = new SpeechSynthesisUtterance(welcomeText);
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [isMuted, useElevenLabs, elevenLabsApiKey, selectedVoice, isOfflineMode]);

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
      if (aiAssistant.isSpeaking) {
        // Add speaking state class for purple pulse effect
        container.classList.add("speaking-active");
        container.classList.remove("listening-active");
      } else {
        // Remove speaking state class
        container.classList.remove("speaking-active");
      }
    }
  }, [aiAssistant.isSpeaking]);

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
    if (aiAssistant.isSpeaking) {
      gif.classList.add("ai-assistant-gif-speaking");
    } else if (isProcessing) {
      gif.classList.add("ai-assistant-gif-normal");
    } else if (speechRecognition.isListening) {
      gif.classList.add("ai-assistant-gif-slow");
    } else {
      gif.classList.add("ai-assistant-gif-idle");
    }

    // No cleanup needed - just a simple class update
  }, [speechRecognition.isListening, isProcessing, aiAssistant.isSpeaking]);

  return (
    <>
      {/* Only render chat UI if showChat is true */}
      {showChat && (
        <div className="card-modern bg-gradient-to-br from-purple-900/30 via-[#232136]/80 to-pink-900/30 border border-purple-500/40 rounded-2xl shadow-2xl backdrop-blur-xl p-0 w-full max-w-2xl mx-auto">
          {/* Offline Mode Banner */}
          {isOfflineMode && (
            <div className="bg-amber-600/20 border-b border-amber-500/30 px-4 py-2 rounded-t-2xl">
              <div className="flex items-center space-x-2">
                <WifiOff className="h-4 w-4 text-amber-400" />
                <span className="text-amber-300 text-sm font-medium">
                  Offline Mode Active
                </span>
                <div className="flex-1"></div>
                <div className="text-xs text-amber-300/80">
                  {apiErrorMessage || "API connection issue"}
                </div>
              </div>
            </div>
          )}

          {/* Workspace Overview Button */}
          <div className="flex justify-end px-4 pt-3">
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex items-center gap-1 bg-purple-900/30 hover:bg-purple-800/40 border-purple-700/30"
              onClick={getWorkspaceOverview}
              disabled={isLoadingWorkspace}
            >
              {isLoadingWorkspace ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <LayoutDashboard className="h-3 w-3 mr-1" />
              )}
              {workspaceOverviewShown
                ? "Refresh Workspace"
                : "Show Workspace Overview"}
            </Button>
          </div>

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
            {/* Intent badge */}
            {lastIntent && (
              <div className="flex justify-center mb-4">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    lastIntent === "notion"
                      ? "bg-blue-600/30 text-blue-300"
                      : lastIntent === "discord"
                      ? "bg-green-600/30 text-green-300"
                      : lastIntent === "calendar"
                      ? "bg-yellow-600/30 text-yellow-300"
                      : "bg-purple-600/30 text-purple-300"
                  }`}
                >
                  {lastIntent === "general"
                    ? "General"
                    : lastIntent.charAt(0).toUpperCase() + lastIntent.slice(1)}
                </span>
              </div>
            )}

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
                        : message.source === "notion"
                        ? "bg-gradient-to-br from-blue-700/95 to-blue-900/95 text-gray-100 border border-blue-500/50"
                        : message.source === "system"
                        ? "bg-gradient-to-br from-indigo-700/95 to-indigo-900/95 text-gray-100 border border-indigo-500/50"
                        : "bg-gradient-to-br from-gray-700/95 to-gray-800/95 text-gray-100 border border-gray-600/50"
                    }`}
                  >
                    {!message.isUser && (
                      <div className="flex items-center space-x-2 mb-2">
                        <div
                          className={`w-2 h-2 ${
                            message.source === "notion"
                              ? "bg-blue-400"
                              : message.source === "discord"
                              ? "bg-green-400"
                              : message.source === "calendar"
                              ? "bg-yellow-400"
                              : message.source === "system"
                              ? "bg-indigo-400"
                              : "bg-purple-400"
                          } rounded-full`}
                        ></div>
                        <span
                          className={`text-xs font-medium ${
                            message.source === "notion"
                              ? "text-blue-400"
                              : message.source === "discord"
                              ? "text-green-400"
                              : message.source === "calendar"
                              ? "text-yellow-400"
                              : message.source === "system"
                              ? "text-indigo-400"
                              : "text-purple-400"
                          }`}
                        >
                          {message.source === "notion"
                            ? "Notion Assistant"
                            : message.source === "discord"
                            ? "Discord Assistant"
                            : message.source === "calendar"
                            ? "Calendar Assistant"
                            : message.source === "system"
                            ? "System Message"
                            : "Assistant"}
                          {isOfflineMode &&
                            message.timestamp >
                              new Date(Date.now() - 60000) && (
                              <span className="ml-2 text-amber-300 text-xs">
                                (Offline)
                              </span>
                            )}
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
                      {isOfflineMode && (
                        <span className="ml-2 text-amber-300">
                          (Offline Mode)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Workspace Loading Indicator */}
            {isLoadingWorkspace && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center"
              >
                <div className="bg-gradient-to-br from-indigo-700/40 to-indigo-900/40 border border-indigo-600/30 rounded-2xl px-5 py-3 backdrop-blur-sm">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span className="text-xs text-indigo-300">
                      Analyzing workspace structure...
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Text Input Area */}
          <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4">
            {isOfflineMode && (
              <div className="mb-3 px-3 py-2 bg-amber-600/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-center text-xs text-amber-300">
                  <AlertTriangle className="h-3 w-3 mr-2 text-amber-400" />
                  <span>
                    {apiErrorMessage ||
                      "Operating in offline mode with limited capabilities."}
                  </span>
                </div>
              </div>
            )}
            <form onSubmit={handleTextSubmit} className="space-y-3">
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={
                    isOfflineMode
                      ? "AI is in offline mode, but you can still ask questions..."
                      : "Type a message or click the animation above for voice :)"
                  }
                  className={`flex-1 bg-gray-800/80 border ${
                    isOfflineMode ? "border-amber-500/30" : "border-gray-600/40"
                  } rounded-xl px-4 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 ${
                    isOfflineMode
                      ? "focus:ring-amber-400"
                      : "focus:ring-purple-400"
                  } focus:border-purple-400/50 focus:bg-gray-800 backdrop-blur-sm transition-all duration-200`}
                  disabled={isProcessing}
                  aria-label="Type your message"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isProcessing}
                  className={`px-4 py-2 ${
                    isOfflineMode
                      ? "bg-gradient-to-r from-amber-600 to-orange-600"
                      : "bg-gradient-to-r from-purple-600 to-blue-600"
                  } text-white text-sm font-medium rounded-xl hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105`}
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
