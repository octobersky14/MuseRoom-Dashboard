import { useState, useEffect, useRef, useCallback } from 'react';
import NotionMcpService, {
  ConnectionStatus,
  AuthStatus,
  NotionMcpServiceOptions,
  McpPageResponse,
  McpDatabaseResponse,
  McpBlockResponse,
  McpUserResponse,
  McpSearchResponse,
  McpCreatePageRequest,
  McpUpdatePageRequest,
  McpCommentRequest,
  McpCommentsResponse
} from '@/services/notionMcpService';

export interface UseNotionMcpOptions {
  notionApiKey?: string;
  mcpServerUrl?: string;
  useFallback?: boolean;
  autoConnect?: boolean;
  autoAuthenticate?: boolean;
  offlineMode?: boolean;
  offlineReason?: string;
}

export interface UseNotionMcpReturn {
  // Connection state
  connectionStatus: ConnectionStatus;
  authStatus: AuthStatus;
  isConnected: boolean;
  isConnecting: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  isOffline: boolean;
  isLoading: boolean;
  error: Error | null;
  
  // Connection methods
  connect: () => Promise<void>;
  disconnect: () => void;
  authenticate: () => Promise<void>;
  enableOfflineMode: (reason?: string) => void;
  disableOfflineMode: () => void;
  getOfflineErrorMessage: () => string;
  
  // Data operations
  search: (query: string, filter?: any) => Promise<McpSearchResponse>;
  view: (type: 'page' | 'database' | 'block', id: string) => Promise<McpPageResponse | McpDatabaseResponse | McpBlockResponse>;
  createPage: (request: McpCreatePageRequest) => Promise<McpPageResponse>;
  updatePage: (request: McpUpdatePageRequest) => Promise<McpPageResponse>;
  createComment: (request: McpCommentRequest) => Promise<any>;
  getComments: (pageId: string) => Promise<McpCommentsResponse>;
  getUsers: () => Promise<{ results: McpUserResponse[] }>;
  getAllPages: () => Promise<McpPageResponse[]>;
  getAllDatabases: () => Promise<McpDatabaseResponse[]>;
}

/**
 * React hook for interacting with the Notion MCP (Model-Context-Protocol)
 * Provides connection management, authentication, and data operations
 */
export const useNotionMcp = (options: UseNotionMcpOptions = {}): UseNotionMcpReturn => {
  // Extract options with defaults
  const {
    notionApiKey = import.meta.env.VITE_NOTION_API_KEY || '',
    mcpServerUrl = import.meta.env.VITE_NOTION_MCP_URL || 'https://mcp.notion.com/sse',
    useFallback = true,
    autoConnect = false,
    autoAuthenticate = false,
    offlineMode = false,
    offlineReason = 'Offline mode enabled by user'
  } = options;

  // State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(AuthStatus.UNAUTHENTICATED);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const notionMcpServiceRef = useRef<NotionMcpService | null>(null);
  
  // Computed state
  const isConnected = connectionStatus === ConnectionStatus.CONNECTED;
  const isConnecting = connectionStatus === ConnectionStatus.CONNECTING;
  const isAuthenticated = authStatus === AuthStatus.AUTHENTICATED;
  const isAuthenticating = authStatus === AuthStatus.AUTHENTICATING;
  const isOffline = connectionStatus === ConnectionStatus.OFFLINE;

  // Initialize the Notion MCP service
  useEffect(() => {
    if (!notionApiKey) {
      setError(new Error('Notion API key is required'));
      return;
    }

    try {
      // Initialize the service with options
      notionMcpServiceRef.current = new NotionMcpService({
        notionApiKey,
        mcpServerUrl,
        useFallback,
        onStatusChange: (status) => {
          setConnectionStatus(status);
          if (status === ConnectionStatus.ERROR) {
            setError(new Error('Connection error'));
          } else {
            setError(null);
          }
        },
        onAuthStatusChange: (status) => {
          setAuthStatus(status);
        }
      });

      // Enable offline mode if requested
      if (offlineMode) {
        notionMcpServiceRef.current.enableOfflineMode(offlineReason);
      }

      // Auto-connect if requested
      if (autoConnect) {
        (async () => {
          try {
            await connect();
            
            // Auto-authenticate if requested and connection successful
            if (autoAuthenticate && isConnected) {
              await authenticate();
            }
          } catch (err) {
            console.error('Auto-connect/authenticate failed:', err);
          }
        })();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to initialize Notion MCP service');
      setError(error);
    }

    // Clean up on unmount
    return () => {
      if (notionMcpServiceRef.current) {
        notionMcpServiceRef.current.disconnect();
      }
    };
  }, [notionApiKey, mcpServerUrl, useFallback, offlineMode, offlineReason, autoConnect, autoAuthenticate]);

  // Connect to the MCP server
  const connect = useCallback(async (): Promise<void> => {
    if (!notionMcpServiceRef.current) {
      throw new Error('Notion MCP service not initialized');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      await notionMcpServiceRef.current.connect();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to connect to Notion MCP');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Disconnect from the MCP server
  const disconnect = useCallback((): void => {
    if (notionMcpServiceRef.current) {
      notionMcpServiceRef.current.disconnect();
    }
  }, []);

  // Authenticate with the MCP server
  const authenticate = useCallback(async (): Promise<void> => {
    if (!notionMcpServiceRef.current) {
      throw new Error('Notion MCP service not initialized');
    }

    if (!isConnected) {
      throw new Error('Must be connected before authenticating');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      await notionMcpServiceRef.current.authenticate();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to authenticate with Notion MCP');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  // Enable offline mode
  const enableOfflineMode = useCallback((reason?: string): void => {
    if (notionMcpServiceRef.current) {
      notionMcpServiceRef.current.enableOfflineMode(reason || offlineReason);
    }
  }, [offlineReason]);

  // Disable offline mode
  const disableOfflineMode = useCallback((): void => {
    if (notionMcpServiceRef.current) {
      notionMcpServiceRef.current.disableOfflineMode();
    }
  }, []);

  // Get offline error message
  const getOfflineErrorMessage = useCallback((): string => {
    if (notionMcpServiceRef.current) {
      return notionMcpServiceRef.current.getOfflineErrorMessage();
    }
    return offlineReason;
  }, [offlineReason]);

  // Search Notion
  const search = useCallback(async (query: string, filter?: any): Promise<McpSearchResponse> => {
    if (!notionMcpServiceRef.current) {
      throw new Error('Notion MCP service not initialized');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await notionMcpServiceRef.current.search(query, filter);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to search Notion');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // View a page, database, or block
  const view = useCallback(async (type: 'page' | 'database' | 'block', id: string): Promise<McpPageResponse | McpDatabaseResponse | McpBlockResponse> => {
    if (!notionMcpServiceRef.current) {
      throw new Error('Notion MCP service not initialized');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await notionMcpServiceRef.current.view(type, id);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(`Failed to view ${type}`);
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a page
  const createPage = useCallback(async (request: McpCreatePageRequest): Promise<McpPageResponse> => {
    if (!notionMcpServiceRef.current) {
      throw new Error('Notion MCP service not initialized');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await notionMcpServiceRef.current.createPage(request);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create page');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update a page
  const updatePage = useCallback(async (request: McpUpdatePageRequest): Promise<McpPageResponse> => {
    if (!notionMcpServiceRef.current) {
      throw new Error('Notion MCP service not initialized');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await notionMcpServiceRef.current.updatePage(request);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update page');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a comment
  const createComment = useCallback(async (request: McpCommentRequest): Promise<any> => {
    if (!notionMcpServiceRef.current) {
      throw new Error('Notion MCP service not initialized');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await notionMcpServiceRef.current.createComment(request);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create comment');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get comments for a page
  const getComments = useCallback(async (pageId: string): Promise<McpCommentsResponse> => {
    if (!notionMcpServiceRef.current) {
      throw new Error('Notion MCP service not initialized');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await notionMcpServiceRef.current.getComments(pageId);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get comments');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get users
  const getUsers = useCallback(async (): Promise<{ results: McpUserResponse[] }> => {
    if (!notionMcpServiceRef.current) {
      throw new Error('Notion MCP service not initialized');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await notionMcpServiceRef.current.getUsers();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get users');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get all pages
  const getAllPages = useCallback(async (): Promise<McpPageResponse[]> => {
    if (!notionMcpServiceRef.current) {
      throw new Error('Notion MCP service not initialized');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await notionMcpServiceRef.current.getAllPages();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get all pages');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get all databases
  const getAllDatabases = useCallback(async (): Promise<McpDatabaseResponse[]> => {
    if (!notionMcpServiceRef.current) {
      throw new Error('Notion MCP service not initialized');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await notionMcpServiceRef.current.getAllDatabases();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get all databases');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Return the hook interface
  return {
    // Connection state
    connectionStatus,
    authStatus,
    isConnected,
    isConnecting,
    isAuthenticated,
    isAuthenticating,
    isOffline,
    isLoading,
    error,
    
    // Connection methods
    connect,
    disconnect,
    authenticate,
    enableOfflineMode,
    disableOfflineMode,
    getOfflineErrorMessage,
    
    // Data operations
    search,
    view,
    createPage,
    updatePage,
    createComment,
    getComments,
    getUsers,
    getAllPages,
    getAllDatabases
  };
};

export default useNotionMcp;
