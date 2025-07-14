import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  ExternalLink,
  Settings,
  Maximize2,
  Minimize2,
  RefreshCw,
  BookOpen,
  Plus,
  Search,
  AlertCircle,
  Link,
  Eye,
  FileText,
  Calendar,
  CheckSquare,
  Users,
  Globe,
  Zap,
  Database,
  Loader2,
  CheckCircle,
  XCircle,
  Edit3,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "./ui/use-toast";
import { useNotionAPI } from "@/hooks/useNotionAPI";
import { NotionTask } from "@/types";
import { NotionPage, NotionDatabase } from "@/services/notionService";

interface NotionWorkspaceEnhancedProps {
  className?: string;
}

export function NotionWorkspaceEnhanced({
  className = "",
}: NotionWorkspaceEnhancedProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDatabase, setSelectedDatabase] = useState<string>("");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [searchResults, setSearchResults] = useState<
    (NotionPage | NotionDatabase)[]
  >([]);

  const { toast } = useToast();
  const notionApiKey = import.meta.env.VITE_NOTION_API_KEY;

  const {
    isLoading,
    error,
    isConnected,
    pages,
    databases,
    tasks,
    testConnection,
    loadPages,
    loadDatabases,
    loadAll,
    search,
    getPageContent,
    getTasks,
    createPage,
    createTask,
    updatePage,
    deletePage,
    clearError,
    createTextBlock,
    createHeadingBlock,
  } = useNotionAPI({
    apiKey: notionApiKey,
    enabled: !!notionApiKey,
  });

  useEffect(() => {
    if (notionApiKey && isConnected) {
      loadAll();
    }
  }, [notionApiKey, isConnected, loadAll]);

  const handleTestConnection = async () => {
    const success = await testConnection();
    if (success) {
      toast({
        title: "Connection Successful! 🎉",
        description: "Successfully connected to your Notion workspace",
      });
    } else {
      toast({
        title: "Connection Failed",
        description: "Please check your API key and integration permissions",
        variant: "destructive",
      });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    const results = await search(searchQuery);
    setSearchResults(results);

    toast({
      title: "Search Complete",
      description: `Found ${results.length} results for "${searchQuery}"`,
    });
  };

  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) return;

    const success = await createPage({
      parent: selectedDatabase
        ? { database_id: selectedDatabase }
        : { page_id: "root" },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: newPageTitle,
              },
            },
          ],
        },
      },
      children: [
        createTextBlock(
          "This page was created from the MuseRoom Dashboard! 🚀"
        ),
        createHeadingBlock("Getting Started", 2),
        createTextBlock(
          "You can now edit this page directly in Notion or through the dashboard."
        ),
      ],
      icon: { type: "emoji", emoji: "📄" },
    });

    if (success) {
      setNewPageTitle("");
      setShowCreatePage(false);
      toast({
        title: "Page Created! 📄",
        description: `Successfully created "${newPageTitle}" in your Notion workspace`,
      });
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !selectedDatabase) return;

    const success = await createTask(selectedDatabase, {
      title: newTaskTitle,
      description: newTaskDescription,
      status: "Not Started",
      priority: "Medium",
    });

    if (success) {
      setNewTaskTitle("");
      setNewTaskDescription("");
      setShowCreateTask(false);
      toast({
        title: "Task Created! ✅",
        description: `Successfully created task "${newTaskTitle}"`,
      });
    }
  };

  const handleLoadTasks = async (databaseId: string) => {
    await getTasks(databaseId);
    setSelectedDatabase(databaseId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "done":
        return "bg-green-100 text-green-800";
      case "in_progress":
      case "in progress":
        return "bg-blue-100 text-blue-800";
      case "not_started":
      case "not started":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!notionApiKey) {
    return (
      <Card className={`${className} border-amber-200 bg-amber-50`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <AlertCircle className="h-5 w-5" />
            Notion Integration Setup Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-amber-700 mb-4">
            To use Notion integration, you need to add your Notion API key to
            your environment variables.
          </p>
          <div className="bg-amber-100 p-4 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Steps:</strong>
            </p>
            <ol className="text-sm text-amber-800 mt-2 space-y-1">
              <li>
                1. Go to{" "}
                <a
                  href="https://www.notion.so/my-integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  notion.so/my-integrations
                </a>
              </li>
              <li>2. Create a new integration</li>
              <li>3. Copy the "Internal Integration Token"</li>
              <li>4. Add it to your .env file as VITE_NOTION_API_KEY</li>
              <li>5. Restart the development server</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className={`${className} space-y-6`}
    >
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Notion Workspace
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Disconnected
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              onClick={handleTestConnection}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button
              onClick={loadAll}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
            <Button
              onClick={() => setShowCreatePage(true)}
              disabled={!isConnected}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Page
            </Button>
            <Button
              onClick={() => setShowCreateTask(true)}
              disabled={!isConnected || databases.length === 0}
              size="sm"
              variant="outline"
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <p className="text-red-700">{error}</p>
                <Button
                  onClick={clearError}
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search pages and databases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isLoading}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Search Results</h3>
              <div className="grid gap-2">
                {searchResults.map((result) => (
                  <Card key={result.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium">
                          {"title" in result
                            ? result.title
                            : "parent" in result
                            ? result.title
                            : "Untitled"}
                        </span>
                        <Badge variant="outline">
                          {"parent" in result ? "Page" : "Database"}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(result.url, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expanded View */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-6"
          >
            {/* Pages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Pages ({pages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pages.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No pages found. Create your first page to get started!
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {pages.slice(0, 10).map((page) => (
                      <Card key={page.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="font-medium">{page.title}</span>
                            <span className="text-sm text-gray-500">
                              {formatDate(page.created_time)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(page.url, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Databases */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Databases ({databases.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {databases.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No databases found. Create a database in Notion to see it
                    here!
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {databases.map((database) => (
                      <Card key={database.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            <span className="font-medium">
                              {database.title}
                            </span>
                            <span className="text-sm text-gray-500">
                              {formatDate(database.created_time)}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLoadTasks(database.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                window.open(database.url, "_blank")
                              }
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tasks */}
            {tasks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5" />
                    Tasks ({tasks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {tasks.map((task) => (
                      <Card key={task.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckSquare className="h-4 w-4" />
                            <span className="font-medium">{task.title}</span>
                            <Badge className={getStatusColor(task.status)}>
                              {task.status}
                            </Badge>
                            {task.due_date && (
                              <span className="text-sm text-gray-500">
                                Due: {formatDate(task.due_date)}
                              </span>
                            )}
                          </div>
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-2">
                            {task.description}
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Page Modal */}
      <AnimatePresence>
        {showCreatePage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Create New Page</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Page title..."
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreatePage}
                    disabled={!newPageTitle.trim()}
                  >
                    Create Page
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreatePage(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Create New Task</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <select
                  className="w-full p-2 border rounded"
                  value={selectedDatabase}
                  onChange={(e) => setSelectedDatabase(e.target.value)}
                >
                  <option value="">Select a database...</option>
                  {databases.map((db) => (
                    <option key={db.id} value={db.id}>
                      {db.title}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Task title..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                />
                <Input
                  placeholder="Task description (optional)..."
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateTask}
                    disabled={!newTaskTitle.trim() || !selectedDatabase}
                  >
                    Create Task
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateTask(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
