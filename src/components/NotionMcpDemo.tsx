import React, { useState, useEffect } from "react";
import { useNotionMcp } from "@/hooks/useNotionMcp";
import {
  ConnectionStatus,
  AuthStatus,
  McpPageResponse,
  McpDatabaseResponse,
} from "@/services/notionMcpService";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { useToast } from "./ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import {
  Search,
  Database,
  File,
  RefreshCw,
  Wifi,
  WifiOff,
  Lock,
  Unlock,
  Plus,
  Eye,
  MessageSquare,
  Users,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const NotionMcpDemo: React.FC = () => {
  // State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<
    "page" | "database" | null
  >(null);
  const [activeTab, setActiveTab] = useState<string>("search");
  const [newPageTitle, setNewPageTitle] = useState<string>("");
  const [newCommentContent, setNewCommentContent] = useState<string>("");
  const [offlineReason, setOfflineReason] = useState<string>("");

  // Use the Notion MCP hook
  const notion = useNotionMcp({
    autoConnect: false, // Don't connect automatically, let the user control it
    autoAuthenticate: false, // Don't authenticate automatically, let the user control it
    useFallback: true, // Enable fallback to proxy-based NotionService
  });

  const { toast } = useToast();

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      await notion.search(searchQuery);
      setActiveTab("search-results");
    } catch (error) {
      toast({
        title: "Search Failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Handle view item
  const handleViewItem = async (id: string, type: "page" | "database") => {
    setSelectedItemId(id);
    setSelectedItemType(type);

    try {
      await notion.view(type, id);
      setActiveTab("view");
    } catch (error) {
      toast({
        title: "Failed to View Item",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Handle create page
  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) return;

    try {
      await notion.createPage({
        title: newPageTitle,
        parent: { type: "workspace" },
      });

      toast({
        title: "Page Created",
        description: `Successfully created page "${newPageTitle}"`,
        variant: "default",
      });

      setNewPageTitle("");

      // Refresh search results
      if (searchQuery) {
        await notion.search(searchQuery);
      }
    } catch (error) {
      toast({
        title: "Failed to Create Page",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Handle create comment
  const handleCreateComment = async () => {
    if (!newCommentContent.trim() || !selectedItemId) return;

    try {
      await notion.createComment({
        parent_id: selectedItemId,
        parent_type: selectedItemType || "page",
        content: newCommentContent,
      });

      toast({
        title: "Comment Added",
        description: "Successfully added comment",
        variant: "default",
      });

      setNewCommentContent("");
    } catch (error) {
      toast({
        title: "Failed to Add Comment",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Handle enable offline mode
  const handleEnableOfflineMode = () => {
    notion.enableOfflineMode(offlineReason || "Manually enabled by user");
    toast({
      title: "Offline Mode Enabled",
      description: offlineReason || "Manually enabled by user",
      variant: "warning",
    });
  };

  // Get connection status badge
  const getConnectionStatusBadge = () => {
    switch (notion.connectionStatus) {
      case ConnectionStatus.CONNECTED:
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800">
            Connected
          </Badge>
        );
      case ConnectionStatus.CONNECTING:
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800">
            Connecting...
          </Badge>
        );
      case ConnectionStatus.DISCONNECTED:
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-800">
            Disconnected
          </Badge>
        );
      case ConnectionStatus.ERROR:
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800">
            Connection Error
          </Badge>
        );
      case ConnectionStatus.OFFLINE:
        return (
          <Badge variant="outline" className="bg-amber-100 text-amber-800">
            Offline Mode
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Get authentication status badge
  const getAuthStatusBadge = () => {
    switch (notion.authStatus) {
      case AuthStatus.AUTHENTICATED:
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800">
            Authenticated
          </Badge>
        );
      case AuthStatus.AUTHENTICATING:
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800">
            Authenticating...
          </Badge>
        );
      case AuthStatus.UNAUTHENTICATED:
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-800">
            Not Authenticated
          </Badge>
        );
      case AuthStatus.ERROR:
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800">
            Auth Error
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Notion MCP Integration</span>
          <div className="flex space-x-2">
            {getConnectionStatusBadge()}
            {getAuthStatusBadge()}
          </div>
        </CardTitle>
        <CardDescription>
          Connect to Notion using the Model-Context-Protocol (MCP)
        </CardDescription>
      </CardHeader>

      {/* Offline Mode Banner */}
      {notion.isOffline && (
        <Alert variant="warning" className="mx-4 mb-4 bg-amber-50">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Offline Mode Active</AlertTitle>
          <AlertDescription>
            {notion.offlineErrorMessage ||
              "Operating in offline mode with mock responses"}
          </AlertDescription>
        </Alert>
      )}

      {/* Fallback Notice */}
      {!notion.isOffline &&
        notion.connectionStatus === ConnectionStatus.ERROR && (
          <Alert variant="default" className="mx-4 mb-4 bg-blue-50">
            <RefreshCw className="h-4 w-4" />
            <AlertTitle>Using Fallback Service</AlertTitle>
            <AlertDescription>
              Connected to Notion via proxy server instead of MCP
            </AlertDescription>
          </Alert>
        )}

      <CardContent>
        {/* Connection Controls */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant="outline"
            onClick={() => notion.connect()}
            disabled={notion.isConnected || notion.isLoading}
            className="flex items-center gap-1"
          >
            <Wifi className="h-4 w-4" />
            Connect
          </Button>

          <Button
            variant="outline"
            onClick={() => notion.disconnect()}
            disabled={!notion.isConnected || notion.isLoading}
            className="flex items-center gap-1"
          >
            <WifiOff className="h-4 w-4" />
            Disconnect
          </Button>

          <Button
            variant="outline"
            onClick={() => notion.authenticate()}
            disabled={
              !notion.isConnected || notion.isAuthenticated || notion.isLoading
            }
            className="flex items-center gap-1"
          >
            <Unlock className="h-4 w-4" />
            Authenticate
          </Button>

          <div className="flex-1"></div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Reason for offline mode"
              value={offlineReason}
              onChange={(e) => setOfflineReason(e.target.value)}
              className="max-w-xs"
            />
            <Button
              variant="outline"
              onClick={handleEnableOfflineMode}
              disabled={notion.isOffline}
              className="flex items-center gap-1"
            >
              <WifiOff className="h-4 w-4" />
              Enable Offline
            </Button>

            <Button
              variant="outline"
              onClick={() => notion.disableOfflineMode()}
              disabled={!notion.isOffline}
              className="flex items-center gap-1"
            >
              <Wifi className="h-4 w-4" />
              Disable Offline
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="search" className="flex items-center gap-1">
              <Search className="h-4 w-4" />
              Search
            </TabsTrigger>
            <TabsTrigger
              value="search-results"
              className="flex items-center gap-1"
            >
              <File className="h-4 w-4" />
              Results
            </TabsTrigger>
            <TabsTrigger
              value="view"
              className="flex items-center gap-1"
              disabled={!selectedItemId}
            >
              <Eye className="h-4 w-4" />
              View
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-1">
              <Plus className="h-4 w-4" />
              Create
            </TabsTrigger>
            <TabsTrigger
              value="comments"
              className="flex items-center gap-1"
              disabled={!selectedItemId}
            >
              <MessageSquare className="h-4 w-4" />
              Comments
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search Notion..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleSearch}
                disabled={notion.isLoading || !searchQuery.trim()}
              >
                {notion.isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search
              </Button>
            </div>

            {notion.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{notion.error.message}</AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="search-results">
            {notion.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-2">
                {notion
                  .search(searchQuery)
                  .then((results) =>
                    results.results.length > 0 ? (
                      results.results.map((item) => (
                        <Card
                          key={item.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => handleViewItem(item.id, item.type)}
                        >
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {item.type === "page" ? (
                                <File className="h-4 w-4 text-blue-500" />
                              ) : (
                                <Database className="h-4 w-4 text-green-500" />
                              )}
                              <span>{item.title}</span>
                            </div>
                            <Badge>{item.type}</Badge>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No results found
                      </div>
                    )
                  )
                  .catch(() => (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>
                        Failed to load search results
                      </AlertDescription>
                    </Alert>
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="view">
            {selectedItemId &&
              selectedItemType &&
              (notion.isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                notion
                  .view(selectedItemType, selectedItemId)
                  .then((item) => (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold">{item.title}</h3>

                      {selectedItemType === "page" && item.content && (
                        <div className="prose max-w-none">
                          <div
                            dangerouslySetInnerHTML={{ __html: item.content }}
                          />
                        </div>
                      )}

                      {selectedItemType === "database" && (
                        <div className="border rounded-md p-4">
                          <h4 className="font-semibold mb-2">
                            Database Properties
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(item.properties || {}).map(
                              ([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="font-medium">{key}:</span>
                                  <span>{value.type}</span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      <div className="text-sm text-gray-500">
                        Last edited:{" "}
                        {new Date(item.last_edited_time).toLocaleString()}
                      </div>
                    </div>
                  ))
                  .catch(() => (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>Failed to load item</AlertDescription>
                    </Alert>
                  ))
              ))}

            {!selectedItemId && (
              <div className="text-center py-8 text-gray-500">
                Select an item to view
              </div>
            )}
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Create a New Page</h3>
              <Input
                placeholder="Page Title"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
              />
              <Button
                onClick={handleCreatePage}
                disabled={notion.isLoading || !newPageTitle.trim()}
              >
                {notion.isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Page
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="comments" className="space-y-4">
            {selectedItemId ? (
              <>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Add a Comment</h3>
                  <Input
                    placeholder="Comment"
                    value={newCommentContent}
                    onChange={(e) => setNewCommentContent(e.target.value)}
                  />
                  <Button
                    onClick={handleCreateComment}
                    disabled={notion.isLoading || !newCommentContent.trim()}
                  >
                    {notion.isLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <MessageSquare className="h-4 w-4 mr-2" />
                    )}
                    Add Comment
                  </Button>
                </div>

                <div className="space-y-2 mt-4">
                  <h3 className="text-lg font-medium">Comments</h3>

                  {notion.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : (
                    notion
                      .getComments(selectedItemId)
                      .then((comments) =>
                        comments.results.length > 0 ? (
                          comments.results.map((comment) => (
                            <Card key={comment.id} className="mb-2">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <User className="h-4 w-4" />
                                  <span className="font-medium">
                                    {comment.created_by.name}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(
                                      comment.created_time
                                    ).toLocaleString()}
                                  </span>
                                </div>
                                <div>
                                  {comment.rich_text.map((text, index) => (
                                    <span key={index}>{text.plain_text}</span>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            No comments yet
                          </div>
                        )
                      )
                      .catch(() => (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription>
                            Failed to load comments
                          </AlertDescription>
                        </Alert>
                      ))
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Select an item to view comments
              </div>
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <h3 className="text-lg font-medium">Workspace Users</h3>

            {notion.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              notion
                .getUsers()
                .then((users) =>
                  users.results.length > 0 ? (
                    <div className="space-y-2">
                      {users.results.map((user) => (
                        <Card key={user.id}>
                          <CardContent className="p-4 flex items-center gap-3">
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt={user.name}
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <User className="h-4 w-4 text-gray-500" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{user.name}</div>
                              {user.email && (
                                <div className="text-sm text-gray-500">
                                  {user.email}
                                </div>
                              )}
                            </div>
                            <Badge variant="outline" className="ml-auto">
                              {user.type}
                            </Badge>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      No users found
                    </div>
                  )
                )
                .catch(() => (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>Failed to load users</AlertDescription>
                  </Alert>
                ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="flex justify-between border-t p-4">
        <div className="text-sm text-gray-500">
          {notion.isOffline ? (
            <span className="flex items-center text-amber-600">
              <WifiOff className="h-4 w-4 mr-1" /> Offline Mode
            </span>
          ) : notion.connectionStatus === ConnectionStatus.ERROR ? (
            <span className="flex items-center text-blue-600">
              <RefreshCw className="h-4 w-4 mr-1" /> Using Fallback Service
            </span>
          ) : notion.isConnected ? (
            <span className="flex items-center text-green-600">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Connected to Notion MCP
            </span>
          ) : (
            <span className="flex items-center text-gray-600">
              <XCircle className="h-4 w-4 mr-1" /> Not Connected
            </span>
          )}
        </div>

        <div className="text-sm text-gray-500">
          {notion.isLoading && (
            <span className="flex items-center">
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Loading...
            </span>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default NotionMcpDemo;
