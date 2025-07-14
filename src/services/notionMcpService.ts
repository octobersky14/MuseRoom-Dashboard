import NotionService from './notionService';
import { EventSourcePolyfill } from 'event-source-polyfill';

// Connection status enum
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  OFFLINE = 'offline'
}

// Authentication status enum
export enum AuthStatus {
  UNAUTHENTICATED = 'unauthenticated',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  ERROR = 'error'
}

// MCP Response interfaces
export interface McpBaseResponse {
  id: string;
  object: string;
  created_time: string;
  last_edited_time: string;
}

export interface McpPageResponse extends McpBaseResponse {
  object: 'page';
  title: string;
  url?: string;
  parent?: {
    type: 'workspace' | 'database' | 'page';
    id?: string;
  };
  properties?: Record<string, any>;
  content?: string;
  archived?: boolean;
}

export interface McpDatabaseResponse extends McpBaseResponse {
  object: 'database';
  title: string;
  url?: string;
  properties?: Record<string, {
    id: string;
    name: string;
    type: string;
    [key: string]: any;
  }>;
  parent?: {
    type: 'workspace' | 'page';
    id?: string;
  };
}

export interface McpBlockResponse extends McpBaseResponse {
  object: 'block';
  type: string;
  has_children: boolean;
  parent: {
    type: 'page' | 'block';
    id: string;
  };
  [key: string]: any;
}

export interface McpUserResponse {
  id: string;
  object: 'user';
  name: string;
  avatar_url?: string;
  type: 'person' | 'bot';
  email?: string;
}

export interface McpSearchResponse {
  object: 'list';
  results: Array<McpPageResponse | McpDatabaseResponse>;
  next_cursor?: string;
  has_more: boolean;
}

export interface McpCommentsResponse {
  object: 'list';
  results: Array<{
    id: string;
    object: 'comment';
    parent_id: string;
    parent_type: 'page' | 'block';
    created_by: McpUserResponse;
    created_time: string;
    rich_text: Array<{
      type: string;
      plain_text: string;
      annotations?: any;
      href?: string;
    }>;
  }>;
  next_cursor?: string;
  has_more: boolean;
}

// MCP Request interfaces
export interface McpCreatePageRequest {
  parent?: {
    type: 'workspace' | 'database' | 'page';
    database_id?: string;
    page_id?: string;
  };
  title: string;
  properties?: Record<string, any>;
  content?: Array<any>;
}

export interface McpUpdatePageRequest {
  page_id: string;
  title?: string;
  properties?: Record<string, any>;
  archived?: boolean;
}

export interface McpCommentRequest {
  parent_id: string;
  parent_type: 'page' | 'block';
  content: string;
}

// Service options interface
export interface NotionMcpServiceOptions {
  notionApiKey: string;
  mcpServerUrl?: string;
  useFallback?: boolean;
  requestTimeout?: number;
  onStatusChange?: (status: ConnectionStatus) => void;
  onAuthStatusChange?: (status: AuthStatus) => void;
}

/**
 * Notion MCP (Model-Context-Protocol) Service
 * 
 * This service provides integration with Notion's official MCP server,
 * which uses Server-Sent Events (SSE) for real-time communication.
 * 
 * Features:
 * - SSE connection management
 * - OAuth authentication
 * - Full MCP API implementation
 * - Offline mode with mock responses
 * - Fallback to proxy-based NotionService
 */
class NotionMcpService {
  private notionApiKey: string;
  private mcpServerUrl: string;
  private useFallback: boolean;
  private requestTimeout: number;
  private eventSource: EventSourcePolyfill | null = null;
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private authStatus: AuthStatus = AuthStatus.UNAUTHENTICATED;
  private fallbackService: NotionService | null = null;
  private offlineMode: boolean = false;
  private offlineErrorMessage: string = '';
  private authWindow: Window | null = null;
  private authPromiseResolve: ((value: unknown) => void) | null = null;
  private authPromiseReject: ((reason?: any) => void) | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private messageIdCounter: number = 0;
  private onStatusChangeCallback?: (status: ConnectionStatus) => void;
  private onAuthStatusChangeCallback?: (status: AuthStatus) => void;

  /**
   * Create a new Notion MCP Service instance
   */
  constructor(options: NotionMcpServiceOptions) {
    this.notionApiKey = options.notionApiKey;
    this.mcpServerUrl = options.mcpServerUrl || 'https://mcp.notion.com/sse';
    this.useFallback = options.useFallback !== false;
    this.requestTimeout = options.requestTimeout || 30000;
    this.onStatusChangeCallback = options.onStatusChange;
    this.onAuthStatusChangeCallback = options.onAuthStatusChange;

    // Initialize fallback service if requested
    if (this.useFallback) {
      try {
        this.fallbackService = new NotionService(this.notionApiKey);
      } catch (error) {
        console.warn('Failed to initialize fallback NotionService:', error);
      }
    }

    // Set up message handler for authentication
    window.addEventListener('message', this.handleAuthMessage);
  }

  /**
   * Get the current connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get the current authentication status
   */
  public getAuthStatus(): AuthStatus {
    return this.authStatus;
  }

  /**
   * Get the offline error message
   */
  public getOfflineErrorMessage(): string {
    return this.offlineErrorMessage;
  }

  /**
   * Set the connection status and trigger callback if provided
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(status);
    }
  }

  /**
   * Set the authentication status and trigger callback if provided
   */
  private setAuthStatus(status: AuthStatus): void {
    this.authStatus = status;
    if (this.onAuthStatusChangeCallback) {
      this.onAuthStatusChangeCallback(status);
    }
  }

  /**
   * Connect to the Notion MCP server using SSE
   */
  public async connect(): Promise<void> {
    // Don't connect if already connecting or connected
    if (
      this.connectionStatus === ConnectionStatus.CONNECTING ||
      this.connectionStatus === ConnectionStatus.CONNECTED
    ) {
      return;
    }

    // Don't connect if in offline mode
    if (this.offlineMode) {
      console.warn('Cannot connect while in offline mode');
      return;
    }

    this.setConnectionStatus(ConnectionStatus.CONNECTING);

    try {
      // Close existing connection if any
      this.disconnect();

      // Create new EventSource connection
      this.eventSource = new EventSourcePolyfill(this.mcpServerUrl, {
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true,
      });

      // Set up event handlers
      this.eventSource.onopen = this.handleConnectionOpen;
      this.eventSource.onerror = this.handleConnectionError;
      this.eventSource.onmessage = this.handleMessage;

      // Wait for connection to establish or timeout
      await Promise.race([
        new Promise<void>((resolve) => {
          const checkConnection = () => {
            if (this.connectionStatus === ConnectionStatus.CONNECTED) {
              resolve();
            } else {
              setTimeout(checkConnection, 100);
            }
          };
          checkConnection();
        }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        ),
      ]);
    } catch (error) {
      this.setConnectionStatus(ConnectionStatus.ERROR);
      console.error('Failed to connect to Notion MCP:', error);
      
      // If fallback is enabled, don't throw error
      if (this.useFallback && this.fallbackService) {
        console.warn('Using fallback NotionService instead');
        return;
      }
      
      throw error;
    }
  }

  /**
   * Disconnect from the Notion MCP server
   */
  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    if (this.connectionStatus !== ConnectionStatus.OFFLINE) {
      this.setConnectionStatus(ConnectionStatus.DISCONNECTED);
    }
    
    // Close auth window if open
    if (this.authWindow && !this.authWindow.closed) {
      this.authWindow.close();
      this.authWindow = null;
    }
    
    // Clear any pending auth promises
    if (this.authPromiseReject) {
      this.authPromiseReject(new Error('Disconnected'));
      this.authPromiseReject = null;
      this.authPromiseResolve = null;
    }
  }

  /**
   * Authenticate with Notion using OAuth
   */
  public async authenticate(): Promise<void> {
    // Don't authenticate if already authenticating or authenticated
    if (
      this.authStatus === AuthStatus.AUTHENTICATING ||
      this.authStatus === AuthStatus.AUTHENTICATED
    ) {
      return;
    }

    // Don't authenticate if not connected
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Must be connected before authenticating');
    }

    // Don't authenticate if in offline mode
    if (this.offlineMode) {
      console.warn('Cannot authenticate while in offline mode');
      return;
    }

    this.setAuthStatus(AuthStatus.AUTHENTICATING);

    try {
      // Create a unique auth state for security
      const authState = Math.random().toString(36).substring(2);
      
      // Open the OAuth window
      const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=notion-mcp&response_type=code&state=${authState}&redirect_uri=${encodeURIComponent(window.location.origin + '/auth/notion/callback')}`;
      this.authWindow = window.open(authUrl, 'notion-auth', 'width=500,height=700');
      
      if (!this.authWindow) {
        throw new Error('Failed to open authentication window. Please allow popups for this site.');
      }

      // Wait for authentication to complete or timeout
      await new Promise((resolve, reject) => {
        this.authPromiseResolve = resolve;
        this.authPromiseReject = reject;
        
        // Set a timeout for authentication
        setTimeout(() => {
          if (this.authStatus !== AuthStatus.AUTHENTICATED) {
            reject(new Error('Authentication timeout'));
          }
        }, 120000); // 2 minutes
      });
      
      this.setAuthStatus(AuthStatus.AUTHENTICATED);
    } catch (error) {
      this.setAuthStatus(AuthStatus.ERROR);
      console.error('Failed to authenticate with Notion:', error);
      
      // If fallback is enabled, don't throw error
      if (this.useFallback && this.fallbackService) {
        console.warn('Using fallback NotionService instead');
        return;
      }
      
      throw error;
    } finally {
      // Clean up
      this.authPromiseResolve = null;
      this.authPromiseReject = null;
      if (this.authWindow && !this.authWindow.closed) {
        this.authWindow.close();
      }
      this.authWindow = null;
    }
  }

  /**
   * Enable offline mode with mock responses
   */
  public enableOfflineMode(reason: string = 'Offline mode enabled'): void {
    this.offlineMode = true;
    this.offlineErrorMessage = reason;
    this.setConnectionStatus(ConnectionStatus.OFFLINE);
    
    // Disconnect from server if connected
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    console.info(`Notion MCP offline mode enabled: ${reason}`);
  }

  /**
   * Disable offline mode and attempt to reconnect
   */
  public disableOfflineMode(): void {
    if (!this.offlineMode) return;
    
    this.offlineMode = false;
    this.offlineErrorMessage = '';
    this.setConnectionStatus(ConnectionStatus.DISCONNECTED);
    
    console.info('Notion MCP offline mode disabled');
  }

  /**
   * Handle connection open event
   */
  private handleConnectionOpen = (): void => {
    console.info('Connected to Notion MCP server');
    this.setConnectionStatus(ConnectionStatus.CONNECTED);
  };

  /**
   * Handle connection error event
   */
  private handleConnectionError = (event: Event): void => {
    console.error('Notion MCP connection error:', event);
    this.setConnectionStatus(ConnectionStatus.ERROR);
    
    // Close the connection
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  };

  /**
   * Handle incoming messages from the SSE connection
   */
  private handleMessage = (event: MessageEvent): void => {
    try {
      const data = JSON.parse(event.data);
      
      // Handle different message types
      if (data.type === 'auth_success') {
        this.setAuthStatus(AuthStatus.AUTHENTICATED);
        if (this.authPromiseResolve) {
          this.authPromiseResolve(true);
        }
      } else if (data.type === 'auth_error') {
        this.setAuthStatus(AuthStatus.ERROR);
        if (this.authPromiseReject) {
          this.authPromiseReject(new Error(data.error || 'Authentication failed'));
        }
      } else if (data.id && this.messageHandlers.has(data.id)) {
        // Call the appropriate message handler
        const handler = this.messageHandlers.get(data.id);
        if (handler) {
          handler(data);
          // Remove the handler after it's called
          this.messageHandlers.delete(data.id);
        }
      }
    } catch (error) {
      console.error('Failed to parse Notion MCP message:', error, event.data);
    }
  };

  /**
   * Handle authentication messages from the popup window
   */
  private handleAuthMessage = (event: MessageEvent): void => {
    // Only accept messages from our origin
    if (event.origin !== window.location.origin) return;
    
    // Check if this is an auth message
    if (event.data && event.data.type === 'notion_auth') {
      if (event.data.success) {
        this.setAuthStatus(AuthStatus.AUTHENTICATED);
        if (this.authPromiseResolve) {
          this.authPromiseResolve(true);
        }
      } else {
        this.setAuthStatus(AuthStatus.ERROR);
        if (this.authPromiseReject) {
          this.authPromiseReject(new Error(event.data.error || 'Authentication failed'));
        }
      }
    }
  };

  /**
   * Send a message to the Notion MCP server and wait for a response
   */
  private async sendMessage<T>(type: string, payload: any = {}): Promise<T> {
    // If in offline mode, return mock response
    if (this.offlineMode) {
      return this.getMockResponse<T>(type, payload);
    }
    
    // If not connected and fallback is available, use fallback
    if (
      (this.connectionStatus !== ConnectionStatus.CONNECTED || 
       this.authStatus !== AuthStatus.AUTHENTICATED) && 
      this.useFallback && 
      this.fallbackService
    ) {
      return this.useFallbackService<T>(type, payload);
    }
    
    // If not connected or authenticated, throw error
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Not connected to Notion MCP server');
    }
    
    if (this.authStatus !== AuthStatus.AUTHENTICATED) {
      throw new Error('Not authenticated with Notion');
    }
    
    // Generate a unique message ID
    const messageId = `msg_${Date.now()}_${this.messageIdCounter++}`;
    
    // Create a promise that will be resolved when the response is received
    const responsePromise = new Promise<T>((resolve, reject) => {
      // Set up a handler for this message ID
      this.messageHandlers.set(messageId, (data) => {
        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve(data.result as T);
        }
      });
      
      // Set a timeout for the response
      setTimeout(() => {
        if (this.messageHandlers.has(messageId)) {
          this.messageHandlers.delete(messageId);
          reject(new Error(`Request timeout for ${type}`));
        }
      }, this.requestTimeout);
    });
    
    // Send the message
    if (this.eventSource && this.eventSource.readyState === EventSourcePolyfill.OPEN) {
      const message = {
        id: messageId,
        type,
        ...payload
      };
      
      // For SSE we can't send messages directly, so we use a hidden iframe or fetch
      const sendUrl = `${this.mcpServerUrl}/send`;
      try {
        await fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
          credentials: 'include',
        });
      } catch (error) {
        this.messageHandlers.delete(messageId);
        throw new Error(`Failed to send message to Notion MCP: ${error}`);
      }
    } else {
      this.messageHandlers.delete(messageId);
      throw new Error('EventSource not open');
    }
    
    // Wait for the response
    return responsePromise;
  }

  /**
   * Use the fallback NotionService for a request
   */
  private async useFallbackService<T>(type: string, payload: any = {}): Promise<T> {
    if (!this.fallbackService) {
      throw new Error('Fallback service not available');
    }
    
    console.info(`Using fallback NotionService for ${type}`);
    
    try {
      let result: any;
      
      switch (type) {
        case 'search':
          result = await this.fallbackService.search(payload.query, payload.filter);
          break;
        case 'view_page':
          result = await this.fallbackService.getPage(payload.id);
          // Also get page content
          const content = await this.fallbackService.getPageContent(payload.id);
          result.content = content;
          break;
        case 'view_database':
          result = await this.fallbackService.getDatabase(payload.id);
          break;
        case 'create_page':
          result = await this.fallbackService.createPage(this.convertMcpToNotionPageRequest(payload));
          break;
        case 'update_page':
          result = await this.fallbackService.updatePage(
            payload.page_id, 
            this.convertMcpToNotionUpdateRequest(payload)
          );
          break;
        case 'get_all_pages':
          result = await this.fallbackService.getAllPages();
          break;
        case 'get_all_databases':
          result = await this.fallbackService.getAllDatabases();
          break;
        default:
          throw new Error(`Unsupported operation for fallback: ${type}`);
      }
      
      // Convert the result to the expected format
      return this.convertNotionToMcpResponse<T>(type, result);
    } catch (error) {
      console.error(`Fallback service error for ${type}:`, error);
      
      // If fallback fails, try offline mode
      if (this.offlineMode) {
        return this.getMockResponse<T>(type, payload);
      }
      
      throw error;
    }
  }

  /**
   * Convert Notion API response to MCP format
   */
  private convertNotionToMcpResponse<T>(type: string, data: any): T {
    // Handle different response types
    switch (type) {
      case 'search':
        return {
          object: 'list',
          results: data.results.map((item: any) => ({
            id: item.id,
            object: item.object,
            created_time: item.created_time,
            last_edited_time: item.last_edited_time,
            title: item.title || 'Untitled',
            url: item.url,
            properties: item.properties,
            parent: item.parent,
          })),
          next_cursor: data.next_cursor,
          has_more: data.has_more,
        } as unknown as T;
      
      case 'view_page':
        return {
          id: data.id,
          object: 'page',
          created_time: data.created_time,
          last_edited_time: data.last_edited_time,
          title: data.title || 'Untitled',
          url: data.url,
          properties: data.properties,
          parent: data.parent,
          content: data.content,
        } as unknown as T;
      
      case 'view_database':
        return {
          id: data.id,
          object: 'database',
          created_time: data.created_time,
          last_edited_time: data.last_edited_time,
          title: data.title || 'Untitled',
          url: data.url,
          properties: data.properties,
          parent: data.parent,
        } as unknown as T;
      
      case 'get_all_pages':
      case 'get_all_databases':
        return data as T;
      
      default:
        return data as T;
    }
  }

  /**
   * Convert MCP page request to Notion API format
   */
  private convertMcpToNotionPageRequest(mcpRequest: McpCreatePageRequest): any {
    const notionRequest: any = {
      parent: {},
      properties: {
        title: {
          title: [
            {
              text: {
                content: mcpRequest.title || 'Untitled',
              },
            },
          ],
        },
      },
    };
    
    // Set parent
    if (mcpRequest.parent) {
      if (mcpRequest.parent.type === 'database' && mcpRequest.parent.database_id) {
        notionRequest.parent.database_id = mcpRequest.parent.database_id;
      } else if (mcpRequest.parent.type === 'page' && mcpRequest.parent.page_id) {
        notionRequest.parent.page_id = mcpRequest.parent.page_id;
      } else {
        notionRequest.parent.workspace = true;
      }
    } else {
      notionRequest.parent.workspace = true;
    }
    
    // Add additional properties
    if (mcpRequest.properties) {
      Object.assign(notionRequest.properties, mcpRequest.properties);
    }
    
    return notionRequest;
  }

  /**
   * Convert MCP update request to Notion API format
   */
  private convertMcpToNotionUpdateRequest(mcpRequest: McpUpdatePageRequest): any {
    const notionRequest: any = {
      properties: {},
    };
    
    // Set title
    if (mcpRequest.title) {
      notionRequest.properties.title = {
        title: [
          {
            text: {
              content: mcpRequest.title,
            },
          },
        ],
      };
    }
    
    // Add additional properties
    if (mcpRequest.properties) {
      Object.assign(notionRequest.properties, mcpRequest.properties);
    }
    
    // Set archived status
    if (mcpRequest.archived !== undefined) {
      notionRequest.archived = mcpRequest.archived;
    }
    
    return notionRequest;
  }

  /**
   * Get a mock response for offline mode
   */
  private getMockResponse<T>(type: string, payload: any = {}): Promise<T> {
    console.info(`Generating mock response for ${type} in offline mode`);
    
    // Generate a mock ID
    const mockId = `mock_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const now = new Date().toISOString();
    
    // Handle different request types
    switch (type) {
      case 'search':
        return Promise.resolve({
          object: 'list',
          results: [
            {
              id: 'mock_page_1',
              object: 'page',
              created_time: now,
              last_edited_time: now,
              title: 'Mock Page 1',
              url: 'https://notion.so/Mock-Page-1',
              parent: { type: 'workspace' },
            },
            {
              id: 'mock_page_2',
              object: 'page',
              created_time: now,
              last_edited_time: now,
              title: 'Mock Page 2',
              url: 'https://notion.so/Mock-Page-2',
              parent: { type: 'workspace' },
            },
            {
              id: 'mock_db_1',
              object: 'database',
              created_time: now,
              last_edited_time: now,
              title: 'Mock Database 1',
              url: 'https://notion.so/Mock-Database-1',
              parent: { type: 'workspace' },
            },
          ],
          next_cursor: null,
          has_more: false,
        } as unknown as T);
      
      case 'view_page':
        return Promise.resolve({
          id: payload.id || 'mock_page_1',
          object: 'page',
          created_time: now,
          last_edited_time: now,
          title: 'Mock Page (Offline Mode)',
          url: `https://notion.so/Mock-Page-${payload.id || 'mock_page_1'}`,
          parent: { type: 'workspace' },
          content: 'This is mock content generated in offline mode. The actual page content would appear here.',
        } as unknown as T);
      
      case 'view_database':
        return Promise.resolve({
          id: payload.id || 'mock_db_1',
          object: 'database',
          created_time: now,
          last_edited_time: now,
          title: 'Mock Database (Offline Mode)',
          url: `https://notion.so/Mock-Database-${payload.id || 'mock_db_1'}`,
          parent: { type: 'workspace' },
          properties: {
            Name: { id: 'title', name: 'Name', type: 'title' },
            Status: { id: 'status', name: 'Status', type: 'select' },
            Date: { id: 'date', name: 'Date', type: 'date' },
          },
        } as unknown as T);
      
      case 'view_block':
        return Promise.resolve({
          id: payload.id || 'mock_block_1',
          object: 'block',
          created_time: now,
          last_edited_time: now,
          type: 'paragraph',
          has_children: false,
          parent: {
            type: 'page',
            id: 'mock_page_1',
          },
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: 'This is mock block content generated in offline mode.',
                },
                plain_text: 'This is mock block content generated in offline mode.',
              },
            ],
          },
        } as unknown as T);
      
      case 'create_page':
        return Promise.resolve({
          id: mockId,
          object: 'page',
          created_time: now,
          last_edited_time: now,
          title: payload.title || 'New Mock Page (Offline Mode)',
          parent: payload.parent || { type: 'workspace' },
          url: `https://notion.so/${mockId}`,
        } as unknown as T);
      
      case 'update_page':
        return Promise.resolve({
          id: payload.page_id || 'mock_page_1',
          object: 'page',
          created_time: now,
          last_edited_time: now,
          title: payload.title || 'Updated Mock Page (Offline Mode)',
          url: `https://notion.so/${payload.page_id || 'mock_page_1'}`,
        } as unknown as T);
      
      case 'create_comment':
        return Promise.resolve({
          id: mockId,
          object: 'comment',
          parent_id: payload.parent_id || 'mock_page_1',
          parent_type: payload.parent_type || 'page',
          created_by: {
            id: 'mock_user_1',
            object: 'user',
            name: 'Mock User',
            avatar_url: null,
            type: 'person',
          },
          created_time: now,
          rich_text: [
            {
              type: 'text',
              plain_text: payload.content || 'Mock comment in offline mode',
            },
          ],
        } as unknown as T);
      
      case 'get_comments':
        return Promise.resolve({
          object: 'list',
          results: [
            {
              id: 'mock_comment_1',
              object: 'comment',
              parent_id: payload.page_id || 'mock_page_1',
              parent_type: 'page',
              created_by: {
                id: 'mock_user_1',
                object: 'user',
                name: 'Mock User',
                avatar_url: null,
                type: 'person',
              },
              created_time: now,
              rich_text: [
                {
                  type: 'text',
                  plain_text: 'This is a mock comment generated in offline mode.',
                },
              ],
            },
          ],
          next_cursor: null,
          has_more: false,
        } as unknown as T);
      
      case 'get_users':
        return Promise.resolve({
          object: 'list',
          results: [
            {
              id: 'mock_user_1',
              object: 'user',
              name: 'Mock User 1',
              avatar_url: null,
              type: 'person',
              email: 'mock1@example.com',
            },
            {
              id: 'mock_user_2',
              object: 'user',
              name: 'Mock User 2',
              avatar_url: null,
              type: 'person',
              email: 'mock2@example.com',
            },
            {
              id: 'mock_bot_1',
              object: 'user',
              name: 'Mock Bot',
              avatar_url: null,
              type: 'bot',
            },
          ],
          next_cursor: null,
          has_more: false,
        } as unknown as T);
      
      case 'get_all_pages':
        return Promise.resolve([
          {
            id: 'mock_page_1',
            object: 'page',
            created_time: now,
            last_edited_time: now,
            title: 'Mock Page 1 (Offline Mode)',
            url: 'https://notion.so/Mock-Page-1',
            parent: { type: 'workspace' },
          },
          {
            id: 'mock_page_2',
            object: 'page',
            created_time: now,
            last_edited_time: now,
            title: 'Mock Page 2 (Offline Mode)',
            url: 'https://notion.so/Mock-Page-2',
            parent: { type: 'workspace' },
          },
        ] as unknown as T);
      
      case 'get_all_databases':
        return Promise.resolve([
          {
            id: 'mock_db_1',
            object: 'database',
            created_time: now,
            last_edited_time: now,
            title: 'Mock Database 1 (Offline Mode)',
            url: 'https://notion.so/Mock-Database-1',
            parent: { type: 'workspace' },
          },
          {
            id: 'mock_db_2',
            object: 'database',
            created_time: now,
            last_edited_time: now,
            title: 'Mock Database 2 (Offline Mode)',
            url: 'https://notion.so/Mock-Database-2',
            parent: { type: 'workspace' },
          },
        ] as unknown as T);
      
      default:
        return Promise.reject(new Error(`Unsupported operation for mock response: ${type}`));
    }
  }

  // Public API Methods

  /**
   * Search Notion for pages and databases
   */
  public async search(query?: string, filter?: any): Promise<McpSearchResponse> {
    return this.sendMessage<McpSearchResponse>('search', { query, filter });
  }

  /**
   * View a page, database, or block
   */
  public async view(
    type: 'page' | 'database' | 'block', 
    id: string
  ): Promise<McpPageResponse | McpDatabaseResponse | McpBlockResponse> {
    return this.sendMessage<McpPageResponse | McpDatabaseResponse | McpBlockResponse>(
      `view_${type}`, 
      { id }
    );
  }

  /**
   * Create a new page
   */
  public async createPage(request: McpCreatePageRequest): Promise<McpPageResponse> {
    return this.sendMessage<McpPageResponse>('create_page', request);
  }

  /**
   * Update an existing page
   */
  public async updatePage(request: McpUpdatePageRequest): Promise<McpPageResponse> {
    return this.sendMessage<McpPageResponse>('update_page', request);
  }

  /**
   * Create a comment on a page or block
   */
  public async createComment(request: McpCommentRequest): Promise<any> {
    return this.sendMessage<any>('create_comment', request);
  }

  /**
   * Get comments for a page
   */
  public async getComments(pageId: string): Promise<McpCommentsResponse> {
    return this.sendMessage<McpCommentsResponse>('get_comments', { page_id: pageId });
  }

  /**
   * Get all users in the workspace
   */
  public async getUsers(): Promise<{ results: McpUserResponse[] }> {
    return this.sendMessage<{ results: McpUserResponse[] }>('get_users');
  }

  /**
   * Get all pages in the workspace
   */
  public async getAllPages(): Promise<McpPageResponse[]> {
    return this.sendMessage<McpPageResponse[]>('get_all_pages');
  }

  /**
   * Get all databases in the workspace
   */
  public async getAllDatabases(): Promise<McpDatabaseResponse[]> {
    return this.sendMessage<McpDatabaseResponse[]>('get_all_databases');
  }
}

export default NotionMcpService;
