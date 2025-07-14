import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi, WifiOff, Loader2, CheckCircle, XCircle } from "lucide-react";

interface McpStatusIndicatorProps {
  mcpStatus: "connecting" | "connected" | "disconnected" | "error";
  mcpTools: Array<{ name: string; description?: string }>;
  serverName?: string;
}

export const McpStatusIndicator: React.FC<McpStatusIndicatorProps> = ({
  mcpStatus,
  mcpTools,
  serverName = "Notion MCP",
}) => {
  const getStatusIcon = () => {
    switch (mcpStatus) {
      case "connecting":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (mcpStatus) {
      case "connecting":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "connected":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "error":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getStatusText = () => {
    switch (mcpStatus) {
      case "connecting":
        return "Connecting...";
      case "connected":
        return "Connected";
      case "error":
        return "Connection Error";
      default:
        return "Disconnected";
    }
  };

  return (
    <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wifi className="h-4 w-4" />
          {serverName} Status
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 mb-3">
          {getStatusIcon()}
          <Badge className={getStatusColor()}>{getStatusText()}</Badge>
        </div>

        {mcpStatus === "connected" && mcpTools.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">Available Tools:</p>
            <div className="flex flex-wrap gap-1">
              {mcpTools.slice(0, 5).map((tool, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tool.name}
                </Badge>
              ))}
              {mcpTools.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{mcpTools.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
