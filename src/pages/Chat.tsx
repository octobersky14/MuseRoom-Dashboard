import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import N8nChat from '@/components/N8nChat';
import { getWebhookUrl } from '@/config/n8n';
import { Button } from '@/components/ui/button';

const Chat: React.FC = () => {
  const navigate = useNavigate();
  const webhookUrl = getWebhookUrl();

  // Ensure dark mode is enforced
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 relative">
      {/* Header */}
      <motion.div
        className="absolute top-0 left-0 right-0 z-50 p-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
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
      </motion.div>

      {/* Chat Container */}
      <div className="pt-20 h-screen p-6">
        <div className="relative h-full">
          {/* Background glow effects */}
          <div className="absolute -inset-6 bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 rounded-3xl blur-3xl" />
          <div className="absolute -inset-3 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 rounded-3xl blur-2xl" />
          
          {/* Main container */}
          <div className="relative h-full bg-gradient-to-br from-gray-900/90 via-gray-800/80 to-gray-900/90 border border-white/20 rounded-3xl backdrop-blur-2xl shadow-2xl overflow-hidden">
            <N8nChat
              webhookUrl={webhookUrl}
              className="h-full"
            />
          </div>
        </div>
      </div>

      {/* Background Effects */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(139,92,246,0.1),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(219,39,119,0.08),transparent_70%)]" />
      </div>
    </div>
  );
};

export default Chat; 