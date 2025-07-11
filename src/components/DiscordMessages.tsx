import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { RefreshCw, Send, MessageSquare, Calendar, User } from "lucide-react";
import { useToast } from "./ui/use-toast";
import { motion } from "framer-motion";
import axios from "axios";

interface DiscordMessage {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  channel: string;
  avatar?: string;
}

export function DiscordMessages() {
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [channelFilter, setChannelFilter] = useState("");
  const [sendSummary, setSendSummary] = useState("");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    fetchMessages();
  }, []);


// Rate limiting variables
let lastRequestTime = 0;
const MIN_INTERVAL = 2000; // 2 seconds between requests
const messageCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds cache

const fetchMessages = async () => {
  console.log("function being called");
  setLoading(true);

  try {
    // Check cache first
    const cacheKey = `messages-${channelFilter || 'all'}`;
    const cached = messageCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log("Using cached data");
      setMessages(cached.data);
      setLastFetch(new Date(cached.timestamp));
      setLoading(false);
      toast({
        title: "Messages Loaded",
        description: `Retrieved ${cached.data.length} messages (cached)`,
      });
      return;
    }

    // Rate limiting - ensure minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < MIN_INTERVAL) {
      const waitTime = MIN_INTERVAL - timeSinceLastRequest;
      console.log(`Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    lastRequestTime = Date.now();

    const response = await axios.post(
      "https://hadleycarr04.app.n8n.cloud/webhook/ai-process",
      {
        action: "read",
        channel: channelFilter || undefined,
      },
      {
        timeout: 15000, // Increased timeout for rate-limited requests
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data) {
      console.log(response);
      const formattedMessages: DiscordMessage[] = response.data.map(
        (msg: any) => ({
          id: msg.id || Math.random().toString(),
          content: msg.content || msg.text || "",
          author: msg.author || msg.username || "Unknown",
          timestamp: msg.timestamp || new Date().toISOString(),
          channel: msg.channel || "general",
          avatar: msg.avatar,
        })
      );

      // Cache the successful response
      messageCache.set(cacheKey, {
        data: formattedMessages,
        timestamp: Date.now()
      });

      setMessages(formattedMessages);
      setLastFetch(new Date());
      toast({
        title: "Messages Fetched",
        description: `Retrieved ${formattedMessages.length} messages`,
      });
    } else {
      // Use mock data if no messages returned
      console.log("no messages returned");
      const mockMessages = generateMockMessages();
      setMessages(mockMessages);
      setLastFetch(new Date());
      toast({
        title: "Demo Messages Loaded",
        description: "Showing sample Discord messages (webhook not configured)",
      });
    }
  } catch (error: any) {
    console.error("Error fetching messages:", error);

    // Handle rate limiting with simple delay
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 5; // Default 5 seconds
      console.log(`Rate limited. Please wait ${retryAfter} seconds before trying again.`);
      
      toast({
        title: "Rate Limited",
        description: `Please wait ${retryAfter} seconds before trying again.`,
        variant: "destructive",
      });

      // Don't retry automatically - just show cached/mock data
      const mockMessages = generateMockMessages();
      setMessages(mockMessages);
      setLastFetch(new Date());
      return;
    }

    // Provide mock data when webhook fails
    const mockMessages = generateMockMessages();
    setMessages(mockMessages);
    setLastFetch(new Date());
    
    toast({
      title: "Using Demo Data",
      description: "Cannot connect to Discord webhook. Showing sample messages.",
      variant: "default",
    });
  } finally {
    setLoading(false);
  }
};

  const generateMockMessages = (): DiscordMessage[] => {
    return [
      {
        id: "1",
        content:
          "Hey everyone! Just finished working on the new voice agent feature. It's looking great!",
        author: "DevUser",
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
        channel: "general",
      },
      {
        id: "2",
        content:
          "That sounds awesome! Can't wait to try it out. When will it be ready?",
        author: "TeamMate",
        timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(), // 3 minutes ago
        channel: "general",
      },
      {
        id: "3",
        content:
          "The voice recognition is working really well. You can ask it to read messages or send summaries!",
        author: "DevUser",
        timestamp: new Date(Date.now() - 1000 * 60 * 1).toISOString(), // 1 minute ago
        channel: "general",
      },
      {
        id: "4",
        content:
          "🚀 New deployment ready! The MuseRoom Voice Agent is now live.",
        author: "BotUser",
        timestamp: new Date().toISOString(), // just now
        channel: "announcements",
      },
    ];
  };

  const sendMessageSummary = async () => {
    if (!sendSummary.trim()) return;

    setLoading(true);
    try {
      const response = await axios.post(
        "https://hadleycarr04.app.n8n.cloud/webhook/ai-process",
        {
          action: "send",
          summary: sendSummary,
          timestamp: new Date().toISOString(),
        },
        {
          timeout: 10000,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data && response.data.success) {
        toast({
          title: "Summary Sent",
          description: "Your summary has been sent to Discord!",
        });
        setSendSummary("");
      } else {
        // Simulate success for demo
        toast({
          title: "Demo Mode",
          description:
            "Summary would be sent to Discord (webhook not configured)",
        });
        setSendSummary("");
      }
    } catch (error: any) {
      console.error("Error sending summary:", error);

      // Simulate success for demo
      toast({
        title: "Demo Mode",
        description:
          "Summary simulated (webhook not available). In production, this would send to Discord.",
      });
      setSendSummary("");
    } finally {
      setLoading(false);
    }
  };

  const generateAutoSummary = () => {
    if (messages.length === 0) {
      toast({
        title: "No Messages",
        description: "No messages to summarize.",
        variant: "destructive",
      });
      return;
    }

    const recentMessages = messages.slice(0, 10);
    const authors = [...new Set(recentMessages.map((msg) => msg.author))];
    const channels = [...new Set(recentMessages.map((msg) => msg.channel))];

    const summary = `Recent Discord activity: ${
      recentMessages.length
    } messages from ${authors.length} users across ${
      channels.length
    } channels. Key contributors: ${authors
      .slice(0, 3)
      .join(", ")}. Latest activity in: ${channels.slice(0, 3).join(", ")}.`;

    setSendSummary(summary);
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Filter by channel..."
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="w-full"
          />
        </div>
        <Button
          onClick ={fetchMessages}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Last Fetch Info */}
      {lastFetch && (
        <div className="text-sm text-muted-foreground text-center">
          Last updated: {lastFetch.toLocaleTimeString()}
        </div>
      )}

      {/* Messages List */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {messages.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {loading
                  ? "Loading messages..."
                  : "No messages found. Click refresh to fetch Discord messages."}
              </p>
            </CardContent>
          </Card>
        ) : (
          messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="discord-message">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">
                          {message.author}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          #{message.channel}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatTimestamp(message.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Send Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Summary to Discord
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter summary message..."
              value={sendSummary}
              onChange={(e) => setSendSummary(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={generateAutoSummary}
              variant="outline"
              disabled={loading || messages.length === 0}
            >
              Auto
            </Button>
          </div>
          <Button
            onClick={sendMessageSummary}
            disabled={loading || !sendSummary.trim()}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            Send Summary
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      {messages.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {messages.length}
                </div>
                <div className="text-xs text-muted-foreground">Messages</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {[...new Set(messages.map((msg) => msg.author))].length}
                </div>
                <div className="text-xs text-muted-foreground">Authors</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {[...new Set(messages.map((msg) => msg.channel))].length}
                </div>
                <div className="text-xs text-muted-foreground">Channels</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
