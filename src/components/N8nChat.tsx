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
import { motion, AnimatePresence } from "framer-motion";

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
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      }, 500);
    } else {
      setIsConnected(false);
    }
  }, [webhookUrl]);

  const handleSend = async () => {
    if (!input.trim() || !webhookUrl || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setIsTyping(true);

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

      const data = await response.json();

      // Debug logging to see what n8n is returning
      console.log("n8n response:", data);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
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
          "Sorry, I'm having trouble connecting right now. Please check your n8n workflow configuration.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
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
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="text-center p-8"
          >
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
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Modern Chat Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-gray-900/50 to-gray-800/50 backdrop-blur-xl"
      >
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 flex items-center justify-center shadow-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -inset-2 bg-gradient-to-br from-purple-500/30 via-pink-500/30 to-blue-500/30 rounded-2xl blur-lg" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">MuseRoom AI</h3>
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-400" : "bg-red-400"
                } shadow-lg`}
              />
              <span className="text-xs text-gray-300 font-medium">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
              {isConnected ? (
                <Wifi className="w-3 h-3 text-green-400" />
              ) : (
                <WifiOff className="w-3 h-3 text-red-400" />
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-gray-400 font-medium">
            Powered by n8n
          </span>
        </div>
      </motion.div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{
                duration: 0.4,
                delay: index * 0.1,
                type: "spring",
                stiffness: 100,
              }}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-3xl px-6 py-4 backdrop-blur-xl border shadow-xl ${
                  message.role === "user"
                    ? "bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 border-purple-500/30 text-white shadow-purple-500/20"
                    : "bg-gradient-to-br from-gray-800/40 to-gray-900/40 border-white/20 text-white shadow-gray-900/20"
                }`}
              >
                <div className="flex items-start space-x-3">
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 mt-1 shadow-lg">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed font-medium">
                      {message.content}
                    </p>
                    <div className="flex items-center space-x-2 mt-3">
                      <p className="text-xs text-gray-400 font-medium">
                        {formatTime(message.timestamp)}
                      </p>
                      {message.role === "user" && (
                        <div className="w-1 h-1 rounded-full bg-green-400" />
                      )}
                    </div>
                  </div>
                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-1 shadow-lg">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Enhanced Loading Indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="flex justify-start"
          >
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 border border-white/20 rounded-3xl px-6 py-4 backdrop-blur-xl shadow-xl">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  <span className="text-sm text-gray-200 font-medium">
                    AI is thinking...
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Modern Input Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-6 border-t border-gray-700/30 bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-xl"
      >
        <div className="flex items-end space-x-4">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={!isConnected || isLoading}
              className="w-full px-6 py-4 bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-gray-600/30 rounded-2xl text-white placeholder-gray-500 backdrop-blur-xl focus:outline-none focus:border-purple-500/60 focus:ring-4 focus:ring-purple-500/30 transition-all duration-300 disabled:opacity-50 font-medium shadow-xl shadow-black/20"
            />
            <button
              onClick={() => inputRef.current?.focus()}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-purple-400 transition-all duration-200 hover:scale-110 hover:bg-gray-800/50 rounded-lg"
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </div>
          <motion.button
            onClick={handleSend}
            disabled={!input.trim() || !isConnected || isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-4 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-2xl text-white hover:from-purple-600 hover:via-pink-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 backdrop-blur-xl border border-purple-500/30 hover:border-purple-500/50 shadow-xl hover:shadow-2xl hover:shadow-purple-500/25 font-semibold"
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default N8nChat;
