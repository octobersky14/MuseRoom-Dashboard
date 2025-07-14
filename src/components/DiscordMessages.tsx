"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Hash,
  MessageSquare,
  Users,
  Clock,
  ChevronRight,
  Search,
  MoreVertical,
  Pin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SplashCursor } from "@/components/ui/splash-cursor";

// Types
interface Message {
  id: string;
  author: {
    name: string;
    avatar: string;
    status: "online" | "away" | "offline";
  };
  content: string;
  timestamp: Date;
  type: "text" | "image" | "file";
  reactions?: { emoji: string; count: number; users: string[] }[];
  isPinned?: boolean;
  threadCount?: number;
}

interface Pod {
  id: string;
  name: string;
  description: string;
  avatar: string;
  color: string;
  memberCount: number;
  unreadCount: number;
  lastActivity: Date;
  isOnline: boolean;
  messages: Message[];
  category: "general" | "development" | "design" | "marketing";
}

// Mock data
const mockPods: Pod[] = [
  {
    id: "1",
    name: "Frontend Team",
    description: "React, TypeScript, and UI discussions",
    avatar:
      "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=64&h=64&q=80&crop=faces&fit=crop",
    color: "bg-blue-500",
    memberCount: 12,
    unreadCount: 3,
    lastActivity: new Date(Date.now() - 1000 * 60 * 15),
    isOnline: true,
    category: "development",
    messages: [
      {
        id: "1",
        author: {
          name: "Alex Chen",
          avatar:
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&q=80&crop=faces&fit=crop",
          status: "online",
        },
        content:
          "Just pushed the new component library updates. The new design tokens are looking great! 🎨",
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        type: "text",
        reactions: [
          { emoji: "🎉", count: 3, users: ["Sarah", "Mike", "Lisa"] },
        ],
        isPinned: true,
      },
      {
        id: "2",
        author: {
          name: "Sarah Kim",
          avatar:
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&q=80&crop=faces&fit=crop",
          status: "online",
        },
        content:
          "The TypeScript migration is almost complete. Should be ready for review by EOD.",
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        type: "text",
        threadCount: 5,
      },
      {
        id: "3",
        author: {
          name: "Mike Johnson",
          avatar:
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&q=80&crop=faces&fit=crop",
          status: "away",
        },
        content:
          "Performance improvements are showing 40% faster load times! 🚀",
        timestamp: new Date(Date.now() - 1000 * 60 * 45),
        type: "text",
        reactions: [
          {
            emoji: "🚀",
            count: 5,
            users: ["Alex", "Sarah", "Lisa", "Tom", "Emma"],
          },
          { emoji: "💯", count: 2, users: ["David", "Anna"] },
        ],
      },
    ],
  },
  {
    id: "2",
    name: "Design System",
    description: "UI/UX patterns and design guidelines",
    avatar:
      "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=64&h=64&q=80&crop=faces&fit=crop",
    color: "bg-purple-500",
    memberCount: 8,
    unreadCount: 7,
    lastActivity: new Date(Date.now() - 1000 * 60 * 5),
    isOnline: true,
    category: "design",
    messages: [
      {
        id: "4",
        author: {
          name: "Emma Wilson",
          avatar:
            "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=64&h=64&q=80&crop=faces&fit=crop",
          status: "online",
        },
        content:
          "New color palette is ready for review. Added dark mode variants for all components.",
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        type: "text",
        isPinned: true,
      },
      {
        id: "5",
        author: {
          name: "David Park",
          avatar:
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=64&h=64&q=80&crop=faces&fit=crop",
          status: "online",
        },
        content:
          "The accessibility audit results are in. We're at 98% WCAG compliance! 🎯",
        timestamp: new Date(Date.now() - 1000 * 60 * 20),
        type: "text",
        reactions: [
          { emoji: "🎯", count: 4, users: ["Emma", "Lisa", "Tom", "Anna"] },
        ],
      },
    ],
  },
  {
    id: "3",
    name: "Product Strategy",
    description: "Roadmap planning and feature discussions",
    avatar:
      "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=64&h=64&q=80&crop=faces&fit=crop",
    color: "bg-green-500",
    memberCount: 15,
    unreadCount: 1,
    lastActivity: new Date(Date.now() - 1000 * 60 * 60),
    isOnline: false,
    category: "general",
    messages: [
      {
        id: "6",
        author: {
          name: "Lisa Rodriguez",
          avatar:
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&q=80&crop=faces&fit=crop",
          status: "away",
        },
        content:
          "Q4 roadmap is finalized. Focus areas: performance, accessibility, and mobile experience.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        type: "text",
        threadCount: 12,
      },
    ],
  },
  {
    id: "4",
    name: "Marketing Hub",
    description: "Campaigns, analytics, and growth strategies",
    avatar:
      "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=64&h=64&q=80&crop=faces&fit=crop",
    color: "bg-orange-500",
    memberCount: 6,
    unreadCount: 0,
    lastActivity: new Date(Date.now() - 1000 * 60 * 120),
    isOnline: true,
    category: "marketing",
    messages: [
      {
        id: "7",
        author: {
          name: "Tom Anderson",
          avatar:
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&q=80&crop=faces&fit=crop",
          status: "offline",
        },
        content:
          "Campaign performance is up 25% this month. Great work everyone! 📈",
        timestamp: new Date(Date.now() - 1000 * 60 * 120),
        type: "text",
        reactions: [
          { emoji: "📈", count: 3, users: ["Anna", "David", "Emma"] },
        ],
      },
    ],
  },
];

// Utility functions
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

const truncateText = (text: string, maxLength: number): string => {
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
};

// Components
const StatusIndicator: React.FC<{ status: "online" | "away" | "offline" }> = ({
  status,
}) => {
  const colors = {
    online: "bg-green-500",
    away: "bg-yellow-500",
    offline: "bg-gray-400",
  };

  return (
    <div
      className={`w-3 h-3 rounded-full ${colors[status]} border-2 border-background`}
    />
  );
};

const MessagePreview: React.FC<{ message: Message }> = ({ message }) => {
  return (
    <div className="flex items-start gap-3 px-3 py-2 rounded-xl bg-gradient-to-br from-purple-900/30 via-[#232136]/60 to-pink-900/30 border border-purple-500/20 backdrop-blur-md hover:bg-purple-900/40 transition-colors group min-w-0">
      <div className="relative flex-shrink-0">
        <Avatar className="h-8 w-8">
          <AvatarImage src={message.author.avatar} alt={message.author.name} />
          <AvatarFallback>
            {message.author.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1">
          <StatusIndicator status={message.author.status} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 min-w-0">
          <span className="font-medium text-sm text-foreground truncate max-w-[120px]">
            {message.author.name}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {formatTimeAgo(message.timestamp)}
          </span>
          {message.isPinned && (
            <Pin className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed break-words max-w-full">
          {truncateText(message.content, 120)}
        </p>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {message.reactions.map((reaction, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs px-2 py-0.5"
                >
                  {reaction.emoji} {reaction.count}
                </Badge>
              ))}
            </div>
          )}
          {message.threadCount && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span>{message.threadCount} replies</span>
            </div>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
    </div>
  );
};

const PodCard: React.FC<{ pod: Pod; onClick: () => void }> = ({
  pod,
  onClick,
}) => {
  // Get last message
  const lastMessage = pod.messages[0];
  // Count unread messages (for demo, use pod.unreadCount)
  const unreadCount = pod.unreadCount;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className="min-w-0"
    >
      <Card
        className="group cursor-pointer hover:shadow-xl transition-all duration-200 bg-gradient-to-br from-purple-900/30 via-[#232136]/80 to-pink-900/30 border border-purple-500/40 backdrop-blur-xl p-0 min-h-[180px] flex flex-col min-w-0"
        onClick={onClick}
      >
        <CardHeader className="pb-3 min-w-0">
          <div className="flex items-center justify-between min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={pod.avatar} alt={pod.name} />
                  <AvatarFallback className={pod.color}>
                    {pod.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                {pod.isOnline && (
                  <div className="absolute -bottom-1 -right-1">
                    <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <CardTitle className="text-lg font-semibold truncate max-w-[120px]">
                    {pod.name}
                  </CardTitle>
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="text-xs px-2 py-0.5 min-w-[20px] h-5 flex items-center justify-center"
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate max-w-[180px]">
                  {pod.description}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{pod.memberCount} members</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Active {formatTimeAgo(pod.lastActivity)}</span>
            </div>
            <Badge variant="outline" className="text-xs capitalize">
              {pod.category}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 min-w-0">
          {/* Summary line instead of message list */}
          {lastMessage ? (
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-7 w-7">
                <AvatarImage
                  src={lastMessage.author.avatar}
                  alt={lastMessage.author.name}
                />
                <AvatarFallback>
                  {lastMessage.author.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground truncate max-w-[100px]">
                {lastMessage.author.name}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {truncateText(lastMessage.content, 48)}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {formatTimeAgo(lastMessage.timestamp)}
              </span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              No recent messages.
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

const DiscordUpdatesPage: React.FC = () => {
  // pods state setter currently unused; underscore to avoid TS warning
  const [pods, _setPods] = useState<Pod[]>(mockPods);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);

  // Filter pods based on selected categories and search
  const filteredPods = pods.filter((pod) => {
    const matchesCategory =
      selectedCategories.size === 0 || selectedCategories.has(pod.category);
    const matchesSearch =
      pod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pod.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Sort pods by last activity
  const sortedPods = [...filteredPods].sort(
    (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()
  );

  const categories = [
    { id: "general", label: "General", icon: MessageSquare },
    { id: "development", label: "Development", icon: Hash },
    { id: "design", label: "Design", icon: Hash },
    { id: "marketing", label: "Marketing", icon: Hash },
  ];

  const totalUnread = pods.reduce((sum, pod) => sum + pod.unreadCount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-10 px-2 sm:px-6 relative overflow-hidden w-full">
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
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-pink-900/10 pointer-events-none z-1" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(139,92,246,0.08),transparent_70%)] pointer-events-none z-2" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(219,39,119,0.06),transparent_70%)] pointer-events-none z-2" />
      {/* Header */}
      <div className="w-full max-w-7xl mx-auto mb-8">
        <div className="rounded-2xl bg-gradient-to-br from-purple-900/40 via-[#232136]/80 to-pink-900/40 border border-purple-500/30 backdrop-blur-xl shadow-lg px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-6 flex-wrap min-w-0">
          <div className="flex items-center gap-4 min-w-0 flex-shrink-0">
            <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Hash className="h-8 w-8 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-600 bg-clip-text text-transparent mb-1 truncate">
                Pod Updates
              </h1>
              <p className="text-base text-muted-foreground truncate">
                {totalUnread > 0
                  ? `${totalUnread} unread messages`
                  : "All caught up!"}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 flex-wrap min-w-0 w-full sm:w-auto">
            <div className="relative flex-1 min-w-[180px] max-w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search pods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/80 border border-border rounded-lg shadow-sm w-full"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 pt-2 pl-2 pr-2 flex-wrap">
              {categories.map((category) => {
                const Icon = category.icon;
                const isSelected = selectedCategories.has(category.id);
                return (
                  <Button
                    key={category.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedCategories((prev) => {
                        const next = new Set(prev);
                        if (next.has(category.id)) {
                          next.delete(category.id);
                        } else {
                          next.add(category.id);
                        }
                        return next;
                      });
                    }}
                    className={`whitespace-nowrap ${
                      isSelected ? "ring-2 ring-purple-400 z-10" : ""
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {category.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {/* Main Content */}
      <div className="w-full max-w-7xl mx-auto relative z-10">
        <AnimatePresence mode="wait">
          {sortedPods.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <Hash className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No pods found
              </h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filter criteria.
              </p>
            </motion.div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full"
            >
              {sortedPods.map((pod) => (
                <PodCard
                  key={pod.id}
                  pod={pod}
                  onClick={() => setSelectedPod(pod)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Pod Detail Modal/Sidebar would go here */}
      {selectedPod && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
          >
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={selectedPod.avatar}
                      alt={selectedPod.name}
                    />
                    <AvatarFallback className={selectedPod.color}>
                      {selectedPod.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-bold">{selectedPod.name}</h2>
                    <p className="text-muted-foreground">
                      {selectedPod.description}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" onClick={() => setSelectedPod(null)}>
                  ×
                </Button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                {selectedPod.messages.map((message) => (
                  <div
                    key={message.id}
                    className="border-b border-border pb-4 last:border-b-0"
                  >
                    <MessagePreview message={message} />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DiscordUpdatesPage;
