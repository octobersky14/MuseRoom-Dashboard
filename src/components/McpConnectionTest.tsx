import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { useAIAssistant } from "@/hooks/useAIAssistant";
import { Loader2, Plug, PlugZap, X } from "lucide-react";
import { useToast } from "./ui/use-toast";

export function McpConnectionTest() {
  const [serverUrl, setServerUrl] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const {
    mcpStatus,
    mcpTools,
    mcpResources,
    mcpPrompts,
    connectToMcpServer,
    disconnectFromMcpServer,
    callMcpTool,
  } = useAIAssistant();

  const handleConnect = async () => {
    if (!serverUrl) {
      toast({
        title: "Error",
        description: "Please enter a server URL",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      await connectToMcpServer({
        type: "sse",
        url: serverUrl,
      });

      toast({
        title: "Connected",
        description: `Successfully connected to MCP server`,
      });
    } catch (error) {
      toast({
        title: "Connection Failed",
        description:
          error instanceof Error ? error.message : "Failed to connect",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectFromMcpServer();
    toast({
      title: "Disconnected",
      description: "Disconnected from MCP server",
    });
  };

  const handleCallTool = async (toolName: string) => {
    try {
      const result = await callMcpTool(toolName, {});
      console.log("Tool result:", result);
      toast({
        title: "Tool Executed",
        description: `Successfully called ${toolName}`,
      });
    } catch (error) {
      toast({
        title: "Tool Failed",
        description:
          error instanceof Error ? error.message : "Failed to call tool",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlugZap className="h-5 w-5" />
          MCP Connection Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <span
            className={`text-sm px-2 py-1 rounded-full ${
              mcpStatus === "connected"
                ? "bg-green-100 text-green-700"
                : mcpStatus === "connecting"
                ? "bg-yellow-100 text-yellow-700"
                : mcpStatus === "error"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {mcpStatus}
          </span>
        </div>

        {/* Connection Form */}
        {mcpStatus === "disconnected" && (
          <div className="space-y-2">
            <Input
              placeholder="Enter MCP server URL (e.g., http://localhost:3000/sse)"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
            />
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Plug className="h-4 w-4 mr-2" />
                  Connect
                </>
              )}
            </Button>
          </div>
        )}

        {/* Disconnect Button */}
        {mcpStatus === "connected" && (
          <Button
            onClick={handleDisconnect}
            variant="outline"
            className="w-full"
          >
            <X className="h-4 w-4 mr-2" />
            Disconnect
          </Button>
        )}

        {/* Available Tools */}
        {mcpStatus === "connected" && mcpTools.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Available Tools:</h3>
            <div className="space-y-1">
              {mcpTools.map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div>
                    <span className="text-sm font-medium">{tool.name}</span>
                    {tool.description && (
                      <p className="text-xs text-gray-600">
                        {tool.description}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCallTool(tool.name)}
                  >
                    Call
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Resources */}
        {mcpStatus === "connected" && mcpResources.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Available Resources:</h3>
            <div className="space-y-1">
              {mcpResources.slice(0, 5).map((resource) => (
                <div key={resource.uri} className="p-2 bg-gray-50 rounded">
                  <span className="text-sm">
                    {resource.name || resource.uri}
                  </span>
                  {resource.description && (
                    <p className="text-xs text-gray-600">
                      {resource.description}
                    </p>
                  )}
                </div>
              ))}
              {mcpResources.length > 5 && (
                <p className="text-xs text-gray-500">
                  ...and {mcpResources.length - 5} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Available Prompts */}
        {mcpStatus === "connected" && mcpPrompts.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Available Prompts:</h3>
            <div className="space-y-1">
              {mcpPrompts.map((prompt) => (
                <div key={prompt.name} className="p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium">{prompt.name}</span>
                  {prompt.description && (
                    <p className="text-xs text-gray-600">
                      {prompt.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Example Usage */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            How to Use:
          </h4>
          <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
            <li>Enter an MCP server URL (SSE endpoint)</li>
            <li>Click Connect to establish connection</li>
            <li>Available tools, resources, and prompts will appear</li>
            <li>Click on tools to execute them</li>
            <li>The AI assistant can now use these tools automatically</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
