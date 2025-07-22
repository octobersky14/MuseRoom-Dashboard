import React, { useEffect } from "react";
import { MessageCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import N8nChat from "@/components/N8nChat";
import { getWebhookUrl } from "@/config/n8n";
import { Button } from "@/components/ui/button";

const Chat: React.FC = () => {
  const navigate = useNavigate();
  const webhookUrl = getWebhookUrl();

  // Ensure dark mode is enforced and page starts at top
  useEffect(() => {
    document.documentElement.classList.add("dark");
    // Force page to start at top
    window.scrollTo(0, 0);
    // Prevent any automatic scrolling
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  return (
    <div className="h-screen bg-black relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-white hover:text-purple-400 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center">
            <MessageCircle className="h-6 w-6 mr-2 text-purple-400" />
            <h1 className="text-xl font-semibold text-white">
              MuseRoom AI Assistant
            </h1>
          </div>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Chat Container */}
      <div className="pt-20 h-[70vh] p-6 relative z-10">
        <div className="relative h-full">
          {/* Main container */}
          <div className="relative h-full bg-gray-900/50 border border-gray-800 rounded-2xl backdrop-blur-sm overflow-hidden">
            <N8nChat webhookUrl={webhookUrl} className="h-full" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
