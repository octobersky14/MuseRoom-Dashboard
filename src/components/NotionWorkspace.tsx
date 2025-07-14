import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  ExternalLink,
  Settings,
  Maximize2,
  Minimize2,
  RefreshCw,
  BookOpen,
  Plus,
  Search,
  Eye,
  FileText,
  Calendar,
  CheckSquare,
  Globe,
  Zap,
  Database,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "./ui/use-toast";

interface NotionWorkspaceProps {
  companyWorkspaceUrl?: string;
  className?: string;
}

interface NotionPage {
  id: string;
  title: string;
  icon: string;
  url: string;
  description: string;
}

export function NotionWorkspace({
  companyWorkspaceUrl = "https://www.notion.so/your-workspace",
  className = "",
}: NotionWorkspaceProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [customWorkspaceUrl, setCustomWorkspaceUrl] =
    useState(companyWorkspaceUrl);
  const [isConfigured, setIsConfigured] = useState(false);
  const { toast } = useToast();

  // Check if workspace is configured
  useEffect(() => {
    const storedUrl = localStorage.getItem("notion_workspace_url");
    if (storedUrl && storedUrl !== "https://www.notion.so/your-workspace") {
      setCustomWorkspaceUrl(storedUrl);
      setIsConfigured(true);
    }
  }, []);

  // Sample company pages (customize these for your actual workspace)
  const companyPages: NotionPage[] = [
    {
      id: "1",
      title: "Team Documentation",
      icon: "📚",
      url: `${customWorkspaceUrl}/Team-Documentation`,
      description: "Company docs, processes, and guidelines",
    },
    {
      id: "2",
      title: "Project Planning",
      icon: "🎯",
      url: `${customWorkspaceUrl}/Project-Planning`,
      description: "Current projects and roadmaps",
    },
    {
      id: "3",
      title: "Meeting Notes",
      icon: "📝",
      url: `${customWorkspaceUrl}/Meeting-Notes`,
      description: "Weekly team meetings and decisions",
    },
    {
      id: "4",
      title: "Knowledge Base",
      icon: "🧠",
      url: `${customWorkspaceUrl}/Knowledge-Base`,
      description: "Technical docs and best practices",
    },
    {
      id: "5",
      title: "Team Calendar",
      icon: "📅",
      url: `${customWorkspaceUrl}/Team-Calendar`,
      description: "Events, deadlines, and schedules",
    },
    {
      id: "6",
      title: "Task Management",
      icon: "✅",
      url: `${customWorkspaceUrl}/Tasks`,
      description: "Track tasks and project progress",
    },
  ];

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate refresh
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Workspace Refreshed",
        description: "Latest content loaded from Notion",
      });
    }, 1000);
  };

  const handleWorkspaceUpdate = () => {
    if (
      customWorkspaceUrl.includes("notion.so") &&
      customWorkspaceUrl !== "https://www.notion.so/your-workspace"
    ) {
      localStorage.setItem("notion_workspace_url", customWorkspaceUrl);
      setIsConfigured(true);
      setShowSettings(false);
      toast({
        title: "Workspace Updated!",
        description: "Your company workspace has been configured",
      });
    } else {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid Notion workspace URL",
        variant: "destructive",
      });
    }
  };

  const quickActions = [
    {
      icon: Plus,
      label: "New Page",
      action: () => {
        window.open(`${customWorkspaceUrl}?new=true`, "_blank");
        toast({
          title: "New Page",
          description: "Opening Notion to create a new page...",
        });
      },
    },
    {
      icon: Search,
      label: "Search",
      action: () => {
        window.open(`${customWorkspaceUrl}`, "_blank");
        toast({
          title: "Search",
          description: "Opening workspace to search...",
        });
      },
    },
    {
      icon: Database,
      label: "All Pages",
      action: () => {
        window.open(customWorkspaceUrl, "_blank");
        toast({ title: "All Pages", description: "Opening full workspace..." });
      },
    },
  ];

  const notionFeatures = [
    {
      icon: FileText,
      title: "Company Docs",
      description: "Access shared documentation and knowledge base",
      action: () => window.open(customWorkspaceUrl, "_blank"),
    },
    {
      icon: CheckSquare,
      title: "Project Tasks",
      description: "View and manage company project tasks",
      action: () => window.open(customWorkspaceUrl, "_blank"),
    },
    {
      icon: Calendar,
      title: "Team Calendar",
      description: "Check team schedules and upcoming events",
      action: () => window.open(customWorkspaceUrl, "_blank"),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className={`w-full ${className}`}
    >
      <Card className="bg-gradient-to-br from-purple-900/30 via-[#232136]/80 to-pink-900/30 border border-purple-500/40 backdrop-blur-xl shadow-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className="p-2 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg border border-purple-500/30"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <BookOpen className="w-5 h-5 text-purple-300" />
              </motion.div>
              <div>
                <CardTitle className="text-lg font-semibold bg-gradient-to-r from-purple-200 to-pink-200 bg-clip-text text-transparent">
                  Company Notion Workspace
                </CardTitle>
                <p className="text-sm text-muted-foreground/80 mt-1">
                  {isConfigured
                    ? "Quick access to your team workspace"
                    : "Configure your workspace URL below"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Status Indicator */}
              {isConfigured && (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-600/20 border border-green-500/30 rounded-full mr-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-300 font-medium">
                    Configured
                  </span>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex items-center gap-1 mr-2">
                {quickActions.map((action) => (
                  <motion.button
                    key={action.label}
                    onClick={action.action}
                    className={`p-2 rounded-lg transition-all duration-200 group border ${
                      isConfigured
                        ? "bg-gray-800/60 hover:bg-gray-700/60 border-gray-600/30 hover:border-purple-500/30"
                        : "bg-gray-800/30 border-gray-600/20 opacity-50 cursor-not-allowed"
                    }`}
                    whileHover={isConfigured ? { scale: 1.05 } : {}}
                    whileTap={isConfigured ? { scale: 0.95 } : {}}
                    title={action.label}
                    disabled={!isConfigured}
                  >
                    <action.icon
                      className={`w-4 h-4 transition-colors ${
                        isConfigured
                          ? "text-gray-400 group-hover:text-purple-300"
                          : "text-gray-500"
                      }`}
                    />
                  </motion.button>
                ))}
              </div>

              {/* Control Buttons */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSetupGuide(!showSetupGuide)}
                className="h-8 w-8 p-0 hover:bg-blue-600/20 hover:text-blue-300 border border-gray-600/30 hover:border-blue-500/30"
                title="Setup Guide"
              >
                <Eye className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className="h-8 w-8 p-0 hover:bg-purple-600/20 hover:text-purple-300 border border-gray-600/30 hover:border-purple-500/30"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="h-8 w-8 p-0 hover:bg-purple-600/20 hover:text-purple-300 border border-gray-600/30 hover:border-purple-500/30"
              >
                <Settings className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 p-0 hover:bg-purple-600/20 hover:text-purple-300 border border-gray-600/30 hover:border-purple-500/30"
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(customWorkspaceUrl, "_blank")}
                className="h-8 w-8 p-0 hover:bg-purple-600/20 hover:text-purple-300 border border-gray-600/30 hover:border-purple-500/30"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Setup Guide Panel */}
          <AnimatePresence>
            {showSetupGuide && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 p-4 bg-blue-900/20 rounded-lg border border-blue-500/30 backdrop-blur-sm"
              >
                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-blue-300 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-300 mb-2">
                      GitHub Pages Setup Guide
                    </h4>
                    <div className="text-xs text-blue-200/80 space-y-2">
                      <p>
                        • <strong>Simple Setup:</strong> No complex backend
                        needed - just direct links to your Notion workspace
                      </p>
                      <p>
                        • <strong>Configure URL:</strong> Add your company's
                        Notion workspace URL in settings
                      </p>
                      <p>
                        • <strong>Team Access:</strong> Everyone can bookmark
                        and access the same workspace
                      </p>
                      <p>
                        • <strong>Free Hosting:</strong> Hosted on GitHub Pages
                        with automatic deployments
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 p-4 bg-gray-900/40 rounded-lg border border-gray-600/30 backdrop-blur-sm"
              >
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">
                      Company Notion Workspace URL
                    </label>
                    <Input
                      value={customWorkspaceUrl}
                      onChange={(e) => setCustomWorkspaceUrl(e.target.value)}
                      placeholder="https://www.notion.so/your-workspace"
                      className="bg-gray-800/60 border-gray-600/40 text-gray-100 placeholder-gray-400 focus:border-purple-500/50 focus:ring-purple-500/20"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      onClick={handleWorkspaceUpdate}
                      size="sm"
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Configure Workspace
                    </Button>

                    {isConfigured && (
                      <span className="text-xs text-green-300 flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        Configured
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground/70 mt-3">
                  Enter your team's main Notion workspace URL. Everyone will
                  access the same workspace.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </CardHeader>

        <CardContent className="p-0">
          <motion.div
            animate={{ height: isExpanded ? "600px" : "400px" }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="relative overflow-hidden rounded-b-xl"
          >
            <div className="relative w-full h-full">
              {isConfigured ? (
                // Configured state - show workspace pages
                <div className="w-full h-full bg-gradient-to-br from-gray-900/60 to-gray-800/60 p-6 rounded-b-xl">
                  <div className="h-full">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-purple-200 mb-2">
                        Company Workspace
                      </h3>
                      <p className="text-gray-300 text-sm">
                        Quick access to your team's shared Notion workspace
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                      {companyPages.map((page, index) => (
                        <motion.div
                          key={page.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className="bg-gray-800/60 p-4 rounded-lg border border-gray-600/30 hover:border-purple-500/30 transition-all duration-200 cursor-pointer group"
                          onClick={() => window.open(page.url, "_blank")}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-xl flex-shrink-0">
                              {page.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-200 group-hover:text-purple-300 transition-colors truncate">
                                {page.title}
                              </h4>
                              <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                                {page.description}
                              </p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-purple-300 transition-colors flex-shrink-0" />
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                      className="mt-4 pt-4 border-t border-gray-600/30"
                    >
                      <Button
                        onClick={() =>
                          window.open(customWorkspaceUrl, "_blank")
                        }
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                      >
                        <Globe className="w-4 h-4 mr-2" />
                        Open Full Workspace
                      </Button>
                    </motion.div>
                  </div>
                </div>
              ) : (
                // Not configured state - show setup UI
                <div className="w-full h-full bg-gradient-to-br from-gray-900/60 to-gray-800/60 p-6 rounded-b-xl">
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      className="mb-6"
                    >
                      <Globe className="w-16 h-16 text-purple-300 mb-4 mx-auto" />
                      <h3 className="text-xl font-semibold text-purple-200 mb-2">
                        Configure Your Workspace
                      </h3>
                      <p className="text-gray-300 text-sm max-w-md">
                        Add your company's Notion workspace URL to get started.
                        Perfect for GitHub Pages hosting!
                      </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mb-6">
                      {notionFeatures.map((feature, index) => (
                        <motion.div
                          key={feature.title}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className="bg-gray-800/60 p-4 rounded-lg border border-gray-600/30 hover:border-purple-500/30 transition-all duration-200 cursor-pointer group"
                          onClick={feature.action}
                        >
                          <feature.icon className="w-6 h-6 text-purple-300 mb-2 group-hover:scale-110 transition-transform" />
                          <h4 className="text-sm font-medium text-gray-200 mb-1">
                            {feature.title}
                          </h4>
                          <p className="text-xs text-gray-400">
                            {feature.description}
                          </p>
                        </motion.div>
                      ))}
                    </div>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                      className="space-y-4"
                    >
                      <Button
                        onClick={() => setShowSettings(true)}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Configure Workspace
                      </Button>

                      <p className="text-xs text-gray-400">
                        Simple setup • No backend required • GitHub Pages ready
                      </p>
                    </motion.div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
