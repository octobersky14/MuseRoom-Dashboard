import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { NotionWorkspaceEnhanced } from "@/components/NotionWorkspaceEnhanced";
import NotionIntegrationTest from "@/components/NotionIntegrationTest";
import NotionMcpDemo from "@/components/NotionMcpDemo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, Database, Code, RefreshCw, Search, Settings, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { SplashCursor } from "@/components/ui/splash-cursor";

const NotionWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("workspace");
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Strong dark-mode enforcement (never allow light mode)
  useEffect(() => {
    // 1) Ensure dark mode initially
    document.documentElement.classList.add("dark");

    // 2) Watch for any removal of the `dark` class and immediately restore it
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class" &&
          !document.documentElement.classList.contains("dark")
        ) {
          document.documentElement.classList.add("dark");
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    // 3) Cleanup – stop observing but keep dark mode active
    return () => {
      observer.disconnect();
      document.documentElement.classList.add("dark");
    };
  }, []);

  // Handle refresh action
  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Workspace Refreshed",
      description: "Your Notion workspace has been refreshed",
      variant: "default",
    });
    
    setIsRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 relative overflow-hidden">
      {/* Fluid splash-cursor background */}
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
      {/* Background gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-transparent to-indigo-900/10 pointer-events-none z-1" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(59,130,246,0.08),transparent_70%)] pointer-events-none z-2" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(99,102,241,0.06),transparent_70%)] pointer-events-none z-2" />

      {/* Main Content - adjusted for sidebar */}
      {/* Shifted by 80 px to account for collapsed sidebar width.
          The sidebar expands over content on hover, so a fixed 80 px offset
          keeps alignment without hard-coding the expanded width. */}
      <div className="container mx-auto px-4 py-6 relative z-10 transition-all duration-300">
        <div className="max-w-6xl mx-auto">
          {/* Header Section */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <motion.h1
                  className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-600 bg-clip-text text-transparent"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                >
                  Notion Workspace
                </motion.h1>
                <motion.p
                  className="text-muted-foreground/80 text-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                >
                  Manage and interact with your Notion content
                </motion.p>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-blue-900/30 hover:bg-blue-800/40 border-blue-700/30 text-blue-100"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh Workspace
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-900/30 hover:bg-gray-800/40 border-gray-700/30"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Main Tabs Navigation */}
          <Card className="bg-gradient-to-br from-gray-900/90 via-gray-900/95 to-gray-900/90 border border-blue-500/20 backdrop-blur-xl mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-400" />
                Notion Integration
              </CardTitle>
              <CardDescription>
                Access and manage your Notion workspace through multiple integration methods
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 bg-gray-800/60 border border-gray-600/30">
                  <TabsTrigger
                    value="workspace"
                    className="flex items-center gap-2 data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300"
                  >
                    <FileText className="w-4 h-4" />
                    Workspace Explorer
                  </TabsTrigger>
                  <TabsTrigger
                    value="mcp"
                    className="flex items-center gap-2 data-[state=active]:bg-indigo-600/20 data-[state=active]:text-indigo-300"
                  >
                    <Database className="w-4 h-4" />
                    Notion MCP
                    <Badge variant="outline" className="ml-1 bg-indigo-900/50 text-indigo-300 border-indigo-700/50 text-[10px] px-1 py-0">BETA</Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="api-test"
                    className="flex items-center gap-2 data-[state=active]:bg-cyan-600/20 data-[state=active]:text-cyan-300"
                  >
                    <Code className="w-4 h-4" />
                    API Testing
                  </TabsTrigger>
                </TabsList>

                {/* Workspace Explorer Tab Content */}
                <TabsContent value="workspace" className="mt-4 space-y-4">
                  <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <NotionWorkspaceEnhanced />
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <Search className="h-4 w-4 mr-2 text-blue-400" />
                        Quick Search
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search your Notion workspace..."
                          className="flex-1 bg-gray-800/80 border border-gray-700/40 rounded-lg px-4 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400/50"
                        />
                        <Button className="bg-blue-600 hover:bg-blue-700">
                          <Search className="h-4 w-4 mr-2" />
                          Search
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Notion MCP Tab Content */}
                <TabsContent value="mcp" className="mt-4">
                  <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <NotionMcpDemo />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* API Testing Tab Content */}
                <TabsContent value="api-test" className="mt-4">
                  <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <Code className="h-4 w-4 mr-2 text-cyan-400" />
                        Notion API Connectivity Test
                      </CardTitle>
                      <CardDescription>
                        Test your connection to the Notion API and verify proxy server functionality
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="mb-4 p-3 bg-gray-800/60 border border-gray-700/40 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-300">
                            This section allows you to test your connection to the Notion API through the proxy server.
                            You can verify that your API key is working correctly and that the proxy server is properly forwarding requests.
                          </p>
                        </div>
                      </div>
                      <NotionIntegrationTest />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Workspace Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm hover:border-blue-700/30 transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Total Pages</p>
                    <p className="text-2xl font-bold text-white">56</p>
                  </div>
                  <div className="p-2 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white">
                    <FileText className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm hover:border-indigo-700/30 transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Databases</p>
                    <p className="text-2xl font-bold text-white">12</p>
                  </div>
                  <div className="p-2 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white">
                    <Database className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm hover:border-cyan-700/30 transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">API Requests</p>
                    <p className="text-2xl font-bold text-white">328</p>
                  </div>
                  <div className="p-2 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 text-white">
                    <Code className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotionWorkspace;
