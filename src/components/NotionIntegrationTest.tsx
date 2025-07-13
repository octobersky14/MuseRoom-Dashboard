import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Loader2, CheckCircle, AlertCircle, Database, FileText, Search, RefreshCw } from 'lucide-react';
import NotionService, { NotionPage, NotionDatabase } from '@/services/notionService';

/**
 * Component to test Notion API integration through our proxy server
 * This helps verify that the CORS proxy is working correctly and 
 * that we can successfully communicate with the Notion API
 */
const NotionIntegrationTest: React.FC = () => {
  // State
  const [notionService, setNotionService] = useState<NotionService | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [searchResults, setSearchResults] = useState<(NotionPage | NotionDatabase)[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('pages');
  const [proxyStatus, setProxyStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // Initialize Notion service
  useEffect(() => {
    const apiKey = import.meta.env.VITE_NOTION_API_KEY;
    if (!apiKey) {
      setError('Notion API key not found in environment variables');
      return;
    }

    try {
      const service = new NotionService(apiKey);
      setNotionService(service);
      
      // Check if proxy is online
      checkProxyStatus();
    } catch (err) {
      setError(`Failed to initialize Notion service: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // Check if the proxy server is running
  const checkProxyStatus = async () => {
    setProxyStatus('checking');
    try {
      const response = await fetch('http://localhost:3005/health');
      if (response.ok) {
        setProxyStatus('online');
      } else {
        setProxyStatus('offline');
      }
    } catch (err) {
      console.error('Proxy server check failed:', err);
      setProxyStatus('offline');
    }
  };

  // Fetch all pages
  const fetchPages = async () => {
    if (!notionService) return;
    
    setIsLoading(true);
    setError(null);
    setActiveTab('pages');
    
    try {
      const result = await notionService.getAllPages();
      setPages(result);
    } catch (err) {
      setError(`Failed to fetch pages: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all databases
  const fetchDatabases = async () => {
    if (!notionService) return;
    
    setIsLoading(true);
    setError(null);
    setActiveTab('databases');
    
    try {
      const result = await notionService.getAllDatabases();
      setDatabases(result);
    } catch (err) {
      setError(`Failed to fetch databases: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Search Notion
  const searchNotion = async () => {
    if (!notionService) return;
    
    setIsLoading(true);
    setError(null);
    setActiveTab('search');
    
    try {
      const result = await notionService.search(searchQuery);
      setSearchResults(result.results);
    } catch (err) {
      setError(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Format date string
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Extract title from properties
  const extractTitle = (properties: any): string => {
    if (!properties) return 'Untitled';
    
    // For pages
    if (properties.title) {
      const titleProp = properties.title;
      if (titleProp.title && titleProp.title.length > 0) {
        return titleProp.title[0].text?.content || 'Untitled';
      }
    }
    
    // For databases or alternative title formats
    const titleProp = Object.values(properties).find(
      (prop: any) => prop.type === 'title'
    ) as any;
    
    if (titleProp?.title?.[0]?.text?.content) {
      return titleProp.title[0].text.content;
    }
    
    return 'Untitled';
  };

  // Render page item
  const renderPageItem = (page: NotionPage) => {
    const title = extractTitle(page.properties);
    
    return (
      <div key={page.id} className="mb-4 p-4 bg-gray-800/40 rounded-lg border border-gray-700/50 hover:bg-gray-800/60 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <FileText className="w-4 h-4 mr-2 text-blue-400" />
            <h3 className="font-medium text-white">{title}</h3>
          </div>
          <Badge variant="outline" className="text-xs">Page</Badge>
        </div>
        <div className="text-xs text-gray-400 mb-2">
          ID: <span className="font-mono">{page.id}</span>
        </div>
        <div className="text-xs text-gray-400 flex justify-between">
          <span>Created: {formatDate(page.created_time)}</span>
          <span>Updated: {formatDate(page.last_edited_time)}</span>
        </div>
        <div className="mt-2">
          <a 
            href={page.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Open in Notion →
          </a>
        </div>
      </div>
    );
  };

  // Render database item
  const renderDatabaseItem = (database: NotionDatabase) => {
    return (
      <div key={database.id} className="mb-4 p-4 bg-gray-800/40 rounded-lg border border-gray-700/50 hover:bg-gray-800/60 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <Database className="w-4 h-4 mr-2 text-green-400" />
            <h3 className="font-medium text-white">{database.title || 'Untitled Database'}</h3>
          </div>
          <Badge variant="outline" className="text-xs bg-green-900/30 text-green-400 border-green-800">Database</Badge>
        </div>
        <div className="text-xs text-gray-400 mb-2">
          ID: <span className="font-mono">{database.id}</span>
        </div>
        <div className="text-xs text-gray-400 flex justify-between">
          <span>Created: {formatDate(database.created_time)}</span>
          <span>Updated: {formatDate(database.last_edited_time)}</span>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          {Object.keys(database.properties).length} properties
        </div>
        <div className="mt-2">
          <a 
            href={database.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Open in Notion →
          </a>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-4xl mx-auto bg-gray-900/70 border-gray-800">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl">Notion Integration Test</CardTitle>
            <CardDescription>
              Test the connection to Notion API via our proxy server
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm">Proxy Status:</span>
            {proxyStatus === 'checking' && (
              <Badge variant="outline" className="bg-yellow-900/30 text-yellow-400 border-yellow-800">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Checking
              </Badge>
            )}
            {proxyStatus === 'online' && (
              <Badge variant="outline" className="bg-green-900/30 text-green-400 border-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Online
              </Badge>
            )}
            {proxyStatus === 'offline' && (
              <Badge variant="outline" className="bg-red-900/30 text-red-400 border-red-800">
                <AlertCircle className="w-3 h-3 mr-1" />
                Offline
              </Badge>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={checkProxyStatus}
              className="h-8 px-2"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="flex space-x-4 mb-6">
          <Button 
            onClick={fetchPages} 
            disabled={isLoading || !notionService || proxyStatus !== 'online'}
            className="flex-1"
          >
            {isLoading && activeTab === 'pages' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            Fetch Pages
          </Button>
          
          <Button 
            onClick={fetchDatabases} 
            disabled={isLoading || !notionService || proxyStatus !== 'online'}
            className="flex-1"
          >
            {isLoading && activeTab === 'databases' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Database className="w-4 h-4 mr-2" />
            )}
            Fetch Databases
          </Button>
          
          <div className="flex flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search query..."
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-l-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading || !notionService || proxyStatus !== 'online'}
            />
            <Button 
              onClick={searchNotion}
              disabled={isLoading || !notionService || !searchQuery.trim() || proxyStatus !== 'online'}
              className="rounded-l-none"
            >
              {isLoading && activeTab === 'search' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Search
            </Button>
          </div>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800/50 rounded-md text-red-200">
            <div className="flex items-center mb-2">
              <AlertCircle className="w-5 h-5 mr-2 text-red-400" />
              <h3 className="font-medium">Error</h3>
            </div>
            <p className="text-sm">{error}</p>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="pages" disabled={isLoading}>
              Pages ({pages.length})
            </TabsTrigger>
            <TabsTrigger value="databases" disabled={isLoading}>
              Databases ({databases.length})
            </TabsTrigger>
            <TabsTrigger value="search" disabled={isLoading}>
              Search Results ({searchResults.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pages" className="max-h-96 overflow-y-auto custom-scrollbar">
            {pages.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                {isLoading ? 'Loading pages...' : 'No pages found. Click "Fetch Pages" to load data.'}
              </div>
            ) : (
              <div>
                {pages.map(renderPageItem)}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="databases" className="max-h-96 overflow-y-auto custom-scrollbar">
            {databases.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                {isLoading ? 'Loading databases...' : 'No databases found. Click "Fetch Databases" to load data.'}
              </div>
            ) : (
              <div>
                {databases.map(renderDatabaseItem)}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="search" className="max-h-96 overflow-y-auto custom-scrollbar">
            {searchResults.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                {isLoading ? 'Searching...' : 'No search results. Enter a query and click "Search" to find pages and databases.'}
              </div>
            ) : (
              <div>
                {searchResults.map((result) => {
                  if ('parent' in result) {
                    return renderPageItem(result as NotionPage);
                  } else {
                    return renderDatabaseItem(result as NotionDatabase);
                  }
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-between border-t border-gray-800 pt-4">
        <div className="text-xs text-gray-400">
          {notionService ? 'Notion service initialized' : 'Notion service not initialized'}
        </div>
        <div className="text-xs text-gray-400">
          Proxy URL: http://localhost:3005/api/notion
        </div>
      </CardFooter>
    </Card>
  );
};

export default NotionIntegrationTest;
