import { useState, useEffect, useRef } from "react";
import {
  Send,
  Paperclip,
  Bot,
  User,
  Loader2,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface N8nChatProps {
  webhookUrl?: string;
  className?: string;
}

const N8nChat: React.FC<N8nChatProps> = ({
  webhookUrl = "",
  className = "",
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive (but not on initial load)
  useEffect(() => {
    if (!isInitialLoad) {
      // Find the messages container and scroll it to the bottom
      const messagesContainer = messagesEndRef.current?.parentElement;
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }
  }, [messages, isInitialLoad]);

  // Check webhook connection
  useEffect(() => {
    if (webhookUrl) {
      setIsConnected(true);
      // Add welcome message with typing effect
      setTimeout(() => {
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content:
              "Hi there! 👋 I'm your MuseRoom AI assistant. How can I help you today?",
            timestamp: new Date(),
          },
        ]);
        setIsInitialLoad(false);
      }, 500);
    } else {
      setIsConnected(false);
      // Add configuration message
      setTimeout(() => {
        setMessages([
          {
            id: "config",
            role: "assistant",
            content:
              "Welcome to MuseRoom AI! To enable chat functionality, please configure your n8n webhook URL in the environment variables (VITE_WEBHOOK_URL).",
            timestamp: new Date(),
          },
        ]);
        setIsInitialLoad(false);
      }, 500);
    }
  }, [webhookUrl]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!webhookUrl) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content:
          "Chat is not configured. Please set up an n8n workflow and add the webhook URL to your environment variables (VITE_WEBHOOK_URL).",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    // setIsTyping(true); // This line was removed

    try {
      const params = new URLSearchParams({
        message: userMessage.content,
        sessionId: "museroom-session",
      });

      // Debug logging to see what we're sending
      console.log("Sending to n8n:", {
        message: userMessage.content,
        sessionId: "museroom-session",
      });
      console.log("Webhook URL:", webhookUrl);
      console.log("Full URL:", `${webhookUrl}?${params}`);

      const response = await fetch(`${webhookUrl}?${params}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error(
          "n8n response not ok:",
          response.status,
          response.statusText
        );
        const errorText = await response.text();
        console.error("n8n error response:", errorText);
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`);
      }

      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const responseText = await response.text();
        console.error("n8n returned non-JSON response:", responseText);
        throw new Error(
          `Expected JSON response but got: ${contentType}. Response: ${responseText.substring(
            0,
            200
          )}...`
        );
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        const responseText = await response.text();
        console.error("Failed to parse n8n response as JSON:", responseText);
        throw new Error(
          `Invalid JSON response from n8n: ${responseText.substring(0, 200)}...`
        );
      }

      // Debug logging to see what n8n is returning
      console.log("n8n response:", data);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          data.output ||
          data.response ||
          data.message ||
          data.text ||
          data.content ||
          "I received your message but couldn't process it properly.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          error instanceof Error
            ? `Error: ${error.message}. Please check your n8n workflow configuration and ensure it returns valid JSON.`
            : "Sorry, I'm having trouble connecting right now. Please check your n8n workflow configuration.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // setIsTyping(false); // This line was removed
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!webhookUrl) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="relative">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 flex items-center justify-center backdrop-blur-xl border border-white/20">
                <Bot className="w-10 h-10 text-purple-400" />
              </div>
              <div className="absolute -inset-4 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 rounded-2xl blur-xl" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              AI Chat Not Configured
            </h3>
            <p className="text-gray-300 text-sm mb-6 max-w-md leading-relaxed">
              To enable the AI chat, you need to set up an n8n workflow with a
              Chat Trigger node and provide the webhook URL.
            </p>
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl p-6 text-sm text-gray-200 text-left backdrop-blur-xl border border-white/10">
              <p className="mb-3 font-semibold text-purple-300">Setup Steps:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Create an n8n workflow with a Chat Trigger node</li>
                <li>Add your domain to the Allowed Origins (CORS) field</li>
                <li>Activate the workflow</li>
                <li>
                  Copy the webhook URL and add it to your environment variables
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Chat Header */}
      <div className="flex items-center p-6 border-b border-gray-800 bg-gray-900/30">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">MuseRoom AI</h3>
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm text-gray-400">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-white border border-gray-700"
              }`}
            >
              <div className="flex items-start space-x-3">
                {message.role === "assistant" && (
                  <div className="w-6 h-6 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <p className="text-xs text-gray-400">
                      {formatTime(message.timestamp)}
                    </p>
                    {message.role === "user" && (
                      <div className="w-1 h-1 rounded-full bg-green-400" />
                    )}
                  </div>
                </div>
                {message.role === "user" && (
                  <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 rounded-lg bg-purple-600 flex items-center justify-center">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  <span className="text-sm text-gray-300">
                    AI is thinking...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-6 border-t border-gray-800 bg-gray-900/30">
        <div className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                console.log("Input onChange triggered:", e.target.value);
                setInput(e.target.value);
              }}
              onKeyPress={(e) => {
                console.log("Input onKeyPress triggered:", e.key);
                handleKeyPress(e);
              }}
              onFocus={() => {
                console.log("Input focused");
              }}
              onBlur={() => {
                console.log("Input blurred");
              }}
              placeholder={
                webhookUrl
                  ? "Type your message..."
                  : "Configure webhook URL to enable chat..."
              }
              disabled={isLoading}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 disabled:opacity-50"
            />
            <button
              onClick={() => inputRef.current?.focus()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-purple-400 transition-colors rounded-lg"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 bg-purple-600 rounded-xl text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            title={
              !webhookUrl
                ? "Configure webhook URL to enable chat"
                : "Send message"
            }
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default N8nChat;
