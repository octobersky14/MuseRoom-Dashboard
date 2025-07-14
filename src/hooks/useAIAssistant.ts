import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import GeminiService from '@/services/geminiService';
import NotionService, { 
  NotionPage, 
  NotionDatabase, 
  NotionBlock,
  CreatePageRequest,
  UpdatePageRequest
} from '@/services/notionService';
import WorkspaceAnalyzer from '@/services/workspaceAnalyzer';  // NEW
import NotionMcpService, {
  ConnectionStatus, 
  AuthStatus,
  McpPageResponse,
  McpDatabaseResponse,
  McpCreatePageRequest,
  McpUpdatePageRequest
} from '@/services/notionMcpService';

// Define message interface
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  intent?: string;
  intentConfidence?: number;
  source?: 'gemini' | 'notion' | 'discord' | 'calendar';
}

// Define hook return type
interface UseAIAssistantReturn {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  isOfflineMode: boolean;
  apiErrorMessage: string;
  sendMessage: (message: string) => Promise<string>;
  clearMessages: () => void;
  detectIntent: (message: string) => Promise<{
    intent: 'notion' | 'discord' | 'calendar' | 'general';
    confidence: number;
    action?: string;
    params?: Record<string, any>;
  }>;
  speakMessage: (text: string, voiceId?: string) => Promise<void>;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  lastDetectedIntent: {
    intent: string;
    confidence: number;
    action?: string;
  } | null;
  // Notion-specific functions
  notionService: NotionService | null;
  notionMcpService: NotionMcpService | null;
  notionConnectionStatus: ConnectionStatus;
  notionAuthStatus: AuthStatus;
  connectToNotion: () => Promise<void>;
  authenticateNotion: () => Promise<void>;
  getNotionPages: () => Promise<NotionPage[]>;
  getNotionDatabases: () => Promise<NotionDatabase[]>;
  createNotionPage: (request: CreatePageRequest | McpCreatePageRequest) => Promise<NotionPage | McpPageResponse>;
  searchNotion: (query: string) => Promise<{
    results: (NotionPage | NotionDatabase)[];
    next_cursor?: string;
    has_more: boolean;
  }>;
  performNotionAction: (
    action: 'create' | 'read' | 'update' | 'delete' | 'search' | 'list',
    resourceType: 'page' | 'database' | 'block' | 'user',
    params?: Record<string, any>
  ) => Promise<any>;
}

// Define hook options
interface UseAIAssistantOptions {
  geminiApiKey?: string;
  notionApiKey?: string;
  elevenLabsApiKey?: string;
  selectedVoice?: string;
  useElevenLabs?: boolean;
  systemInstruction?: string;
  initialMessages?: Message[];
  onError?: (error: Error) => void;
  onIntentDetected?: (intent: string, confidence: number, action?: string) => void;
  notionMcpMode?: 'direct' | 'proxy' | 'offline';
  notionMcpUrl?: string;
}

/**
 * React hook for a unified AI assistant that integrates Gemini with Notion
 * using either the official Notion MCP, proxy server, or offline mode
 */
export const useAIAssistant = (options: UseAIAssistantOptions = {}): UseAIAssistantReturn => {
  // Extract options with defaults
  const {
    geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || '',
    notionApiKey = import.meta.env.VITE_NOTION_API_KEY || '',
    elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY || '',
    selectedVoice = 'EXAVITQu4vr4xnSDxMaL', // Default ElevenLabs voice
    useElevenLabs = !!elevenLabsApiKey,
    systemInstruction,
    initialMessages = [],
    onError,
    onIntentDetected,
    notionMcpMode = (import.meta.env.VITE_NOTION_MCP_MODE as 'direct' | 'proxy' | 'offline') || 'direct',
    notionMcpUrl = import.meta.env.VITE_NOTION_MCP_URL || 'https://mcp.notion.com/sse'
  } = options;

  // State
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [lastDetectedIntent, setLastDetectedIntent] = useState<{
    intent: string;
    confidence: number;
    action?: string;
  } | null>(null);

  /* Offline-mode / API-error handling */
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(notionMcpMode === 'offline');
  const [apiErrorMessage, setApiErrorMessage] = useState<string>('');
  const [notionConnectionStatus, setNotionConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [notionAuthStatus, setNotionAuthStatus] = useState<AuthStatus>(AuthStatus.UNAUTHENTICATED);

  // Refs
  const geminiServiceRef = useRef<GeminiService | null>(null);
  const notionServiceRef = useRef<NotionService | null>(null);
  const notionMcpServiceRef = useRef<NotionMcpService | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const workspaceAnalyzerRef = useRef<WorkspaceAnalyzer | null>(null); // NEW
  const [workspaceSummary, setWorkspaceSummary] = useState<string>(''); // NEW

  // Initialize services
  useEffect(() => {
    // Initialize Gemini service
    if (geminiApiKey) {
      try {
        geminiServiceRef.current = new GeminiService(geminiApiKey);
        
        // Set the system instruction - this will be added to conversation history
        // rather than passed as a parameter in the API call
        const baseInstruction = systemInstruction ||
          `You are an AI assistant integrated into the MuseRoom Dashboard.
You ALREADY have fully authenticated access (via secure backend services) to:
• The user's Notion workspace
• The user's Discord server/channels
• The user's Google Calendar

All required API keys and credentials are managed by the system—never ask the user
to provide authentication tokens, API keys, or any credentials.

Be helpful, concise, and friendly while assisting with tasks such as creating,
reading, updating, or searching Notion pages/databases, interacting with Discord
messages/channels, and managing Google Calendar events.`

        // If we already have a workspace summary, append it now
        if (workspaceSummary) {
          geminiServiceRef.current.setSystemInstruction(
            `${baseInstruction}\n\n---\n# Workspace Overview\n${workspaceSummary}`
          );
        } else {
          geminiServiceRef.current.setSystemInstruction(baseInstruction);
        }

        /* NOTE:
         * We no longer perform an *immediate* API-key validation here.
         * GeminiService now keeps a debounced, class-level validation
         * cache that will be triggered lazily the first time an actual
         * request is made.  This prevents multiple components from
         * performing redundant validation calls in parallel.
         */
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to initialize Gemini service');
        setError(error);
        if (onError) onError(error);
      }
    } else {
      setError(new Error('Gemini API key is required'));
      if (onError) onError(new Error('Gemini API key is required'));
    }

    // Initialize Notion service based on MCP mode
    if (notionApiKey) {
      try {
        // Always initialize the proxy-based NotionService as a fallback
        if (notionMcpMode === 'proxy' || notionMcpMode === 'direct') {
          notionServiceRef.current = new NotionService(notionApiKey);
        }
        
        // Initialize NotionMcpService if using direct MCP or offline mode
        if (notionMcpMode === 'direct' || notionMcpMode === 'offline') {
          notionMcpServiceRef.current = new NotionMcpService({
            notionApiKey,
            mcpServerUrl: notionMcpUrl,
            useFallback: notionMcpMode === 'direct', // Enable fallback for direct mode
            onStatusChange: (status) => {
              setNotionConnectionStatus(status);
              if (status === ConnectionStatus.OFFLINE) {
                setIsOfflineMode(true);
                setApiErrorMessage(notionMcpServiceRef.current?.getOfflineErrorMessage() || 'Notion MCP is offline');
              }
            },
            onAuthStatusChange: (status) => {
              setNotionAuthStatus(status);
            }
          });
          
          // If offline mode is explicitly requested, enable it
          if (notionMcpMode === 'offline') {
            notionMcpServiceRef.current.enableOfflineMode('Offline mode selected in configuration');
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to initialize Notion service');
        setError(error);
        if (onError) onError(error);
      }
    } else {
      console.warn('Notion API key is missing - Notion integration will be unavailable');
    }

    // Initialise workspace analyser once Notion service is ready
    if (notionApiKey && !workspaceAnalyzerRef.current) {
      workspaceAnalyzerRef.current = new WorkspaceAnalyzer(notionApiKey);
      // Fetch summary async
      (async () => {
        try {
          const summary = await workspaceAnalyzerRef.current!.getWorkspaceSummary();
          setWorkspaceSummary(summary);
        } catch (err) {
          console.warn('Failed to fetch workspace summary:', err);
        }
      })();
    }

    // Clean up on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      if (notionMcpServiceRef.current) {
        notionMcpServiceRef.current.disconnect();
      }
    };
  }, [geminiApiKey, notionApiKey, systemInstruction, onError, notionMcpMode, notionMcpUrl]);

  /* -----------------------------------------------------------
   * Effect: update Gemini system instruction once summary ready
   * --------------------------------------------------------- */
  useEffect(() => {
    if (workspaceSummary && geminiServiceRef.current) {
      const current = geminiServiceRef.current;
      // Re-apply system instruction including summary
      const existing = current.getSystemInstruction?.() || ''; // optional helper
      // Avoid duplication
      if (!existing.includes(workspaceSummary)) {
        current.setSystemInstruction(`${existing}\n\n---\n# Workspace Overview\n${workspaceSummary}`);
      }
    }
  }, [workspaceSummary]);

  // Connect to Notion MCP
  const connectToNotion = useCallback(async (): Promise<void> => {
    if (notionMcpServiceRef.current) {
      try {
        await notionMcpServiceRef.current.connect();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to connect to Notion MCP');
        setError(error);
        if (onError) onError(error);
        throw error;
      }
    } else {
      throw new Error('Notion MCP service not initialized');
    }
  }, [onError]);

  // Authenticate with Notion MCP
  const authenticateNotion = useCallback(async (): Promise<void> => {
    if (notionMcpServiceRef.current) {
      try {
        await notionMcpServiceRef.current.authenticate();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to authenticate with Notion MCP');
        setError(error);
        if (onError) onError(error);
        throw error;
      }
    } else {
      throw new Error('Notion MCP service not initialized');
    }
  }, [onError]);

  // Generate a unique ID for messages
  const generateId = useCallback(() => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }, []);

  // Refs for debouncing intent detection
  const lastIntentCallRef = useRef<{
    timestamp: number;
    message: string;
    promise: Promise<{
      intent: 'notion' | 'discord' | 'calendar' | 'general';
      confidence: number;
      action?: string;
      params?: Record<string, any>;
    }>;
  } | null>(null);

  // Detect intent from a message with debouncing
  const detectIntent = useCallback(
    async (message: string) => {
      if (!geminiServiceRef.current) {
        throw new Error('Gemini service not initialized');
      }
      
      // Debounce: if the same message was processed recently, return the cached promise
      const now = Date.now();
      if (
        lastIntentCallRef.current &&
        lastIntentCallRef.current.message === message &&
        now - lastIntentCallRef.current.timestamp < 800
      ) {
        return lastIntentCallRef.current.promise;
      }
      
      // Create a new promise for this intent detection
      const intentPromise = (async () => {
        try {
          const intentResult = await geminiServiceRef.current!.detectIntent(message);
          
          // Update last detected intent
          setLastDetectedIntent({
            intent: intentResult.intent,
            confidence: intentResult.confidence,
            action: intentResult.action,
          });
          
          // Notify about intent if callback provided
          if (onIntentDetected) {
            onIntentDetected(
              intentResult.intent, 
              intentResult.confidence, 
              intentResult.action
            );
          }
          
          return intentResult;
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to detect intent');
          setError(error);
          if (onError) onError(error);

          // If this looks like an API-key / quota problem, switch to offline mode
          const msg = error.message.toLowerCase();
          if (
            msg.includes('api key') ||
            msg.includes('quota') ||
            msg.includes('rate limit')
          ) {
            setIsOfflineMode(true);
            setApiErrorMessage(error.message);
          }

          throw error;
        }
      })();
      
      // Store the promise for potential reuse
      lastIntentCallRef.current = {
        timestamp: now,
        message,
        promise: intentPromise
      };
      
      return intentPromise;
    },
    [onError, onIntentDetected]
  );

  // Perform a Notion-specific action
  const performNotionAction = useCallback(
    async (
      action: 'create' | 'read' | 'update' | 'delete' | 'search' | 'list',
      resourceType: 'page' | 'database' | 'block' | 'user',
      params?: Record<string, any>
    ) => {
      // Try MCP service first if available
      if (notionMcpServiceRef.current) {
        try {
          let result;

          switch (action) {
            case 'search':
              result = await notionMcpServiceRef.current.search(params?.query, params?.filter);
              break;
            case 'list':
              if (resourceType === 'page') {
                result = await notionMcpServiceRef.current.getAllPages();
              } else if (resourceType === 'database') {
                result = await notionMcpServiceRef.current.getAllDatabases();
              } else {
                throw new Error(`Listing ${resourceType} is not supported`);
              }
              break;
            case 'read':
              if (resourceType === 'page') {
                if (params?.id) {
                  result = await notionMcpServiceRef.current.view('page', params.id);
                } else {
                  throw new Error('Page ID is required');
                }
              } else if (resourceType === 'database') {
                if (params?.id) {
                  result = await notionMcpServiceRef.current.view('database', params.id);
                } else {
                  throw new Error('Database ID is required');
                }
              } else if (resourceType === 'block') {
                if (params?.id) {
                  result = await notionMcpServiceRef.current.view('block', params.id);
                } else {
                  throw new Error('Block ID is required');
                }
              } else {
                throw new Error(`Reading ${resourceType} is not supported`);
              }
              break;
            case 'create':
              if (resourceType === 'page') {
                if (params?.request) {
                  result = await notionMcpServiceRef.current.createPage(params.request);
                } else {
                  throw new Error('Page creation request is required');
                }
              } else {
                throw new Error(`Creating ${resourceType} is not supported`);
              }
              break;
            case 'update':
              if (resourceType === 'page') {
                if (params?.id && params?.request) {
                  result = await notionMcpServiceRef.current.updatePage({
                    page_id: params.id,
                    ...params.request
                  });
                } else {
                  throw new Error('Page ID and update request are required');
                }
              } else {
                throw new Error(`Updating ${resourceType} is not supported`);
              }
              break;
            default:
              throw new Error(`Action ${action} is not supported by Notion MCP`);
          }

          return result;
        } catch (err) {
          // If MCP fails and we have a fallback service, try that instead
          if (notionServiceRef.current) {
            console.warn(`Notion MCP action failed, falling back to proxy: ${err}`);
            return performNotionActionWithProxy(action, resourceType, params);
          }
          
          // Otherwise, propagate the error
          const error = err instanceof Error 
            ? err 
            : new Error(`Failed to perform Notion MCP action: ${action} on ${resourceType}`);
          setError(error);
          if (onError) onError(error);
          throw error;
        }
      } else if (notionServiceRef.current) {
        // If no MCP service, use the proxy service
        return performNotionActionWithProxy(action, resourceType, params);
      } else {
        throw new Error('No Notion service is available');
      }
    },
    [onError]
  );

  // Helper function to perform action with proxy-based NotionService
  const performNotionActionWithProxy = useCallback(
    async (
      action: 'create' | 'read' | 'update' | 'delete' | 'search' | 'list',
      resourceType: 'page' | 'database' | 'block' | 'user',
      params?: Record<string, any>
    ) => {
      if (!notionServiceRef.current) {
        throw new Error('Notion proxy service not initialized');
      }

      try {
        let result;
        
        switch (action) {
          case 'search':
            result = await notionServiceRef.current.search(params?.query, params?.filter);
            break;
          case 'list':
            if (resourceType === 'page') {
              result = await notionServiceRef.current.getAllPages();
            } else if (resourceType === 'database') {
              result = await notionServiceRef.current.getAllDatabases();
            } else {
              throw new Error(`Listing ${resourceType} is not supported`);
            }
            break;
          case 'read':
            if (resourceType === 'page') {
              if (params?.id) {
                result = await notionServiceRef.current.getPage(params.id);
              } else {
                throw new Error('Page ID is required');
              }
            } else if (resourceType === 'database') {
              if (params?.id) {
                result = await notionServiceRef.current.getDatabase(params.id);
              } else {
                throw new Error('Database ID is required');
              }
            } else if (resourceType === 'block') {
              if (params?.id) {
                result = await notionServiceRef.current.getPageContent(params.id);
              } else {
                throw new Error('Block ID is required');
              }
            } else {
              throw new Error(`Reading ${resourceType} is not supported`);
            }
            break;
          case 'create':
            if (resourceType === 'page') {
              if (params?.request) {
                result = await notionServiceRef.current.createPage(params.request);
              } else {
                throw new Error('Page creation request is required');
              }
            } else {
              throw new Error(`Creating ${resourceType} is not supported`);
            }
            break;
          case 'update':
            if (resourceType === 'page') {
              if (params?.id && params?.request) {
                result = await notionServiceRef.current.updatePage(params.id, params.request);
              } else {
                throw new Error('Page ID and update request are required');
              }
            } else {
              throw new Error(`Updating ${resourceType} is not supported`);
            }
            break;
          case 'delete':
            if (resourceType === 'page') {
              if (params?.id) {
                result = await notionServiceRef.current.deletePage(params.id);
              } else {
                throw new Error('Page ID is required');
              }
            } else {
              throw new Error(`Deleting ${resourceType} is not supported`);
            }
            break;
          default:
            throw new Error(`Action ${action} is not supported`);
        }

        return result;
      } catch (err) {
        const error = err instanceof Error 
          ? err 
          : new Error(`Failed to perform Notion action: ${action} on ${resourceType}`);
        setError(error);
        if (onError) onError(error);
        throw error;
      }
    },
    [onError, notionServiceRef]
  );

  // Wrapper functions for common Notion operations
  const getNotionPages = useCallback(async () => {
    return performNotionAction('list', 'page');
  }, [performNotionAction]);

  const getNotionDatabases = useCallback(async () => {
    return performNotionAction('list', 'database');
  }, [performNotionAction]);

  const createNotionPage = useCallback(async (request: CreatePageRequest | McpCreatePageRequest) => {
    return performNotionAction('create', 'page', { request });
  }, [performNotionAction]);

  const searchNotion = useCallback(async (query: string) => {
    return performNotionAction('search', 'page', { query });
  }, [performNotionAction]);

  // Process user message with Notion context if needed
  const processMessageWithNotionContext = useCallback(
    async (messageText: string, intentResult: any): Promise<string> => {
      /* ------------------------------------------------------
       * 0.  Workspace-overview / team-specific smart replies
       * ---------------------------------------------------- */
      if (workspaceAnalyzerRef.current) {
        const analyzer = workspaceAnalyzerRef.current;

        // Quick helper: detect "workspace overview" questions
        const workspaceQ = /(workspace|notion)\s+(overview|summary|status)/i;
        if (workspaceQ.test(messageText)) {
          return await analyzer.getWorkspaceSummary();
        }

        // Helper: detect team names mentioned in the message
        const detectTeamName = () => {
          const teams = ['ai pod', 'ai team', 'agentic ai', 'marketing', 'daw', 'design', 'ui', 'ux', 'gtm'];
          const lower = messageText.toLowerCase();
          return teams.find((t) => lower.includes(t)) || null;
        };

        const teamName = detectTeamName();
        if (teamName) {
          return await analyzer.getTeamWorkStatus(teamName);
        }
      }

      // If it's a Notion-related intent, augment the AI response with actual Notion data
      if (intentResult.intent === 'notion') {
        try {
          let notionContext = '';
          
          // Based on the detected action, fetch relevant Notion data
          if (intentResult.action === 'search' || intentResult.action === 'list') {
            // Get pages and databases to provide context
            const pages = await getNotionPages();
            const databases = await getNotionDatabases();
            
            notionContext = `
              I found ${pages.length} pages and ${databases.length} databases in your Notion workspace.
              
              Pages:
              ${pages.slice(0, 5).map(page => `- ${page.title || 'Untitled'}`).join('\n')}
              ${pages.length > 5 ? `...and ${pages.length - 5} more` : ''}
              
              Databases:
              ${databases.slice(0, 5).map(db => `- ${db.title || 'Untitled'}`).join('\n')}
              ${databases.length > 5 ? `...and ${databases.length - 5} more` : ''}
            `;
          } else if (intentResult.action === 'read' && intentResult.params?.resourceId) {
            // Fetch specific page content
            const pageId = intentResult.params.resourceId;
            
            try {
              let pageData;
              let content;
              
              // Try to get the page data using the appropriate service
              if (notionMcpServiceRef.current) {
                pageData = await notionMcpServiceRef.current.view('page', pageId);
                content = pageData.content || '';
              } else if (notionServiceRef.current) {
                pageData = await notionServiceRef.current.getPage(pageId);
                content = await notionServiceRef.current.getPageContent(pageId);
              }
              
              if (pageData) {
                notionContext = `
                  Page Title: ${pageData.title || 'Untitled'}
                  Last Edited: ${new Date(pageData.last_edited_time).toLocaleString()}
                  Content: ${typeof content === 'string' ? content : JSON.stringify(content)}
                `;
              }
            } catch (error) {
              console.error('Error fetching page content:', error);
              notionContext = `
                I encountered an error fetching the page with ID ${pageId}.
                Please check if the page exists and you have access to it.
              `;
            }
          }
          
          // Now send the user message along with the Notion context to Gemini
          if (notionContext && geminiServiceRef.current) {
            const enhancedPrompt = `
              User message: "${messageText}"
              
              Notion Context:
              ${notionContext}
              
              Please respond to the user's request using the Notion information provided above.
              Be conversational and helpful. If you need more specific information from Notion,
              let the user know what you need.
            `;
            
            // We no longer pass systemInstruction as a parameter
            return await geminiServiceRef.current.sendMessage(enhancedPrompt);
          }
        } catch (error) {
          console.error('Error fetching Notion context:', error);
          // Fall back to regular processing if Notion fetch fails
        }
      }
      
      // Default: process with Gemini without special context
      if (geminiServiceRef.current) {
        return await geminiServiceRef.current.processMessage(messageText);
      }
      
      throw new Error('Neither Gemini nor Notion services are available');
    },
    [getNotionPages, getNotionDatabases]
  );

  // Send a message to the AI and get a response
  const sendMessage = useCallback(
    async (messageText: string): Promise<string> => {
      if (!geminiServiceRef.current) {
        const error = new Error('Gemini service not initialized');
        setError(error);
        if (onError) onError(error);
        return '';
      }

      setIsLoading(true);
      setError(null);

      try {
        // Add user message to state
        const userMessage: Message = {
          id: generateId(),
          role: 'user',
          content: messageText,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);

        // Detect intent from the message
        const intentResult = await detectIntent(messageText);
        
        // Update last detected intent
        setLastDetectedIntent({
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          action: intentResult.action,
        });

        // Notify about intent if callback provided
        if (onIntentDetected) {
          onIntentDetected(
            intentResult.intent, 
            intentResult.confidence, 
            intentResult.action
          );
        }

        // Process the message with Notion context if needed
        const response = await processMessageWithNotionContext(messageText, intentResult);

        // Add assistant response to state
        const assistantMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          intent: intentResult.intent,
          intentConfidence: intentResult.confidence,
          source: intentResult.intent === 'notion' ? 'notion' : 'gemini',
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Speak the response if needed
        if (useElevenLabs && elevenLabsApiKey) {
          await speakMessage(response, selectedVoice);
        }

        setIsLoading(false);
        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to send message to AI');
        setError(error);
        if (onError) onError(error);

        // Switch to offline mode on key/quota issues
        const msg = error.message.toLowerCase();
        if (
          msg.includes('api key') ||
          msg.includes('quota') ||
          msg.includes('rate limit')
        ) {
          setIsOfflineMode(true);
          setApiErrorMessage(error.message);
        }

        setIsLoading(false);
        return '';
      }
    },
    [
      generateId, 
      useElevenLabs, 
      elevenLabsApiKey, 
      selectedVoice, 
      onError, 
      onIntentDetected,
      processMessageWithNotionContext,
      detectIntent
    ]
  );

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    if (geminiServiceRef.current) {
      geminiServiceRef.current.clearHistory();
    }
  }, []);

  // Speak a message using ElevenLabs
  const speakMessage = useCallback(
    async (text: string, voiceId?: string): Promise<void> => {
      if (!useElevenLabs || !elevenLabsApiKey) {
        // Fallback to browser's text-to-speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
        return;
      }

      try {
        setIsSpeaking(true);
        
        // Stop any current audio playback
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        // Create a new audio element
        const audio = new Audio();
        audioRef.current = audio;
        
        // Set up audio event handlers
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => {
          setIsSpeaking(false);
          setError(new Error('Failed to play audio'));
          if (onError) onError(new Error('Failed to play audio'));
        };

        // Make request to ElevenLabs API
        const response = await axios.post(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || selectedVoice}`,
          {
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
            },
          },
          {
            headers: {
              'xi-api-key': elevenLabsApiKey,
              'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer',
          }
        );

        // Create blob and URL from response
        const blob = new Blob([response.data], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        
        // Set the source and play
        audio.src = url;
        await audio.play();
        
        // Clean up URL when done
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
        };
      } catch (err) {
        setIsSpeaking(false);
        const error = err instanceof Error ? err : new Error('Failed to speak message');
        setError(error);
        if (onError) onError(error);
        
        // Fallback to browser's text-to-speech (with speaking state updates)
        const fallbackUtterance = new SpeechSynthesisUtterance(text);
        fallbackUtterance.onstart = () => setIsSpeaking(true);
        fallbackUtterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(fallbackUtterance);
      }
    },
    [useElevenLabs, elevenLabsApiKey, selectedVoice, onError]
  );

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  // Return the hook interface
  return {
    messages,
    isLoading,
    error,
    isOfflineMode,
    apiErrorMessage,
    sendMessage,
    clearMessages,
    detectIntent,
    speakMessage,
    stopSpeaking,
    isSpeaking,
    lastDetectedIntent,
    // Notion-specific functions
    notionService: notionServiceRef.current,
    notionMcpService: notionMcpServiceRef.current,
    notionConnectionStatus,
    notionAuthStatus,
    connectToNotion,
    authenticateNotion,
    getNotionPages,
    getNotionDatabases,
    createNotionPage,
    searchNotion,
    performNotionAction,
  };
};

export default useAIAssistant;
