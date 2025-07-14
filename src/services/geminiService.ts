import { GoogleGenerativeAI, GenerativeModel, Part, Tool } from '@google/generative-ai';

// Define interfaces for Gemini API
interface GeminiMessage {
  role: 'user' | 'model';
  parts: Part[];
}

interface GeminiRequestOptions {
  temperature?: number;
  maxOutputTokens?: number;
  tools?: Tool[];
}

export interface NotionActionParams {
  action: 'create' | 'read' | 'update' | 'delete' | 'search' | 'list';
  resourceType: 'page' | 'database' | 'block' | 'user';
  resourceId?: string;
  data?: Record<string, any>;
}

export interface DiscordActionParams {
  action: 'read' | 'send' | 'summarize';
  channelId?: string;
  messageId?: string;
  content?: string;
  limit?: number;
}

export interface CalendarActionParams {
  action: 'list' | 'create' | 'update' | 'delete';
  eventId?: string;
  timeMin?: string;
  timeMax?: string;
  eventData?: {
    summary: string;
    description?: string;
    start?: { dateTime: string; timeZone: string };
    end?: { dateTime: string; timeZone: string };
    attendees?: Array<{ email: string }>;
  };
}

class GeminiService {
  private apiKey: string;
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private modelName: string = 'gemini-1.5-flash';
  private conversationHistory: GeminiMessage[] = [];
  private maxHistoryLength: number = 10;
  private systemInstruction: string = '';
  private isApiKeyValid: boolean = true;
  private useMockMode: boolean = false;
  private apiKeyErrorMessage: string = '';

  /* ------------------------------------------------------------------
   * Static, class-level state so all instances share API-key status
   * ------------------------------------------------------------------ */
  private static apiStatus: 'unknown' | 'valid' | 'invalid' = 'unknown';
  private static apiKeyErrorMessageStatic: string = '';
  private static lastCheckPromise: Promise<boolean> | null = null;
  private static lastCheckTimestamp = 0;
  private static readonly COOLDOWN_MS = 60_000; // 1-minute cool-down

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });

    // Set default system instruction
    this.systemInstruction = `You are an AI assistant integrated into the MuseRoom Dashboard.
You ALREADY have fully authenticated access (via secure backend services) to:
• The user's Notion workspace
• The user's Discord server/channels
• The user's Google Calendar

All required API keys and credentials are managed by the system—never ask the user
to provide authentication tokens, API keys, or any credentials.

Your job is to be helpful, concise, and friendly while assisting with tasks such as
creating, reading, updating, or searching Notion pages/databases, interacting with
Discord messages/channels, and managing Google Calendar events.`;

    // Sync per-instance flags with cached class state (no network call)
    if (GeminiService.apiStatus === 'valid') {
      this.isApiKeyValid = true;
      this.useMockMode = false;
    } else if (GeminiService.apiStatus === 'invalid') {
      this.isApiKeyValid = false;
      this.useMockMode = true;
      this.apiKeyErrorMessage = GeminiService.apiKeyErrorMessageStatic;
    }
  }

  /**
   * Check if the API key is valid by making a simple request
   * @returns Promise<boolean> - Whether the API key is valid
   */
  public async checkApiKey(): Promise<boolean> {
    /* 1.  Return cached result if known  --------------------------------- */
    if (GeminiService.apiStatus === 'valid') {
      this.isApiKeyValid = true;
      this.useMockMode = false;
      return true;
    }
    if (GeminiService.apiStatus === 'invalid') {
      this.isApiKeyValid = false;
      this.useMockMode = true;
      this.apiKeyErrorMessage = GeminiService.apiKeyErrorMessageStatic;
      return false;
    }

    /* 2.  Debounce / reuse any in-flight validation ---------------------- */
    const now = Date.now();
    if (
      GeminiService.lastCheckPromise &&
      now - GeminiService.lastCheckTimestamp < GeminiService.COOLDOWN_MS
    ) {
      return GeminiService.lastCheckPromise.then((isValid) => {
        this.isApiKeyValid = isValid;
        this.useMockMode = !isValid;
        this.apiKeyErrorMessage = GeminiService.apiKeyErrorMessageStatic;
        return isValid;
      });
    }

    /* 3.  Perform the actual validation (once) --------------------------- */
    GeminiService.lastCheckTimestamp = now;
    GeminiService.lastCheckPromise = (async () => {
      try {
        const testModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const testChat = testModel.startChat({
          generationConfig: { maxOutputTokens: 10 },
        });
        await testChat.sendMessage('test');

        // Success -> mark as valid
        GeminiService.apiStatus = 'valid';
        GeminiService.apiKeyErrorMessageStatic = '';
        return true;
      } catch (error: any) {
        GeminiService.apiStatus = 'invalid';

        if (error instanceof Error) {
          const msg = error.message.toLowerCase();
          if (
            msg.includes('api key expired') ||
            msg.includes('invalid api key') ||
            msg.includes('api_key_invalid')
          ) {
            GeminiService.apiKeyErrorMessageStatic =
              'The Gemini API key has expired. Please contact the administrator to renew it.';
          } else if (
            msg.includes('quota') ||
            msg.includes('rate limit') ||
            msg.includes('exceeded')
          ) {
            GeminiService.apiKeyErrorMessageStatic =
              'The Gemini API quota has been exceeded. Please try again later or contact the administrator.';
          } else {
            GeminiService.apiKeyErrorMessageStatic =
              'There was an issue connecting to the Gemini API. Using offline mode for now.';
          }
        } else {
          GeminiService.apiKeyErrorMessageStatic =
            'Unknown error connecting to the Gemini API. Using offline mode for now.';
        }

        console.warn(
          'Gemini API key issue detected:',
          GeminiService.apiKeyErrorMessageStatic
        );
        console.warn('Switching to mock response mode');
        return false;
      }
    })();

    const isValid = await GeminiService.lastCheckPromise;
    this.isApiKeyValid = isValid;
    this.useMockMode = !isValid;
    this.apiKeyErrorMessage = GeminiService.apiKeyErrorMessageStatic;
    return isValid;
  }

  /**
   * Set or update the system instruction
   */
  public setSystemInstruction(instruction: string): void {
    this.systemInstruction = instruction;
  }

  /**
   * Set the Gemini model to use
   */
  public setModel(model: string): void {
    this.modelName = model;
    if (this.isApiKeyValid) {
      this.model = this.genAI.getGenerativeModel({ model: this.modelName });
    }
  }

  /**
   * Clear conversation history
   */
  public clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get a mock response based on the message content
   * Used when the API key is invalid
   */
  private getMockResponse(message: string): string {
    // Check if it's a Notion-related query
    if (message.toLowerCase().includes('notion')) {
      return "I can help you with your Notion workspace. I already have secure access to your Notion content through the backend integration. What would you like to do with your Notion pages or databases?";
    }
    
    // Check if it's a Discord-related query
    if (message.toLowerCase().includes('discord')) {
      return "I can help you manage your Discord channels and messages. What would you like to do with Discord today?";
    }
    
    // Check if it's a Calendar-related query
    if (message.toLowerCase().includes('calendar') || 
        message.toLowerCase().includes('schedule') || 
        message.toLowerCase().includes('event')) {
      return "I can help you manage your Google Calendar. Would you like to check your schedule, create a new event, or update an existing one?";
    }
    
    // Default response for general queries
    return "I'm here to help you with Notion, Discord, and Google Calendar. While I'm currently operating in offline mode due to an API connection issue, I can still provide information about how these integrations work. What would you like to know?";
  }

  /**
   * Send a message to Gemini and get a response
   */
  public async sendMessage(
    message: string,
    options: GeminiRequestOptions = {}
  ): Promise<string> {
    // If we're in mock mode, return a mock response
    if (this.useMockMode) {
      const mockResponse = this.getMockResponse(message);
      
      // Still add the messages to history for consistency
      this.addMessageToHistory({
        role: 'user',
        parts: [{ text: message }],
      });
      
      this.addMessageToHistory({
        role: 'model',
        parts: [{ text: mockResponse }],
      });
      
      return `${mockResponse}\n\n(Note: I'm currently operating in offline mode. ${this.apiKeyErrorMessage})`;
    }
    
    try {
      // Prepare messages for Gemini API - we don't use systemInstruction parameter anymore
      const chat = this.model.startChat({
        history: this.prepareMessages(),
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxOutputTokens ?? 1024,
        },
        tools: options.tools,
      });

      // Generate response
      const result = await chat.sendMessage(message);
      const response = result.response;
      const responseText = response.text();

      // Persist the turn in local history (user then model)
      this.addMessageToHistory({
        role: 'user',
        parts: [{ text: message }],
      });
      // Add model's response to history
      this.addMessageToHistory({
        role: 'model',
        parts: [{ text: responseText }],
      });

      return responseText;
    } catch (error) {
      // Check if it's an API key issue
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('api key expired') || 
            errorMessage.includes('invalid api key') || 
            errorMessage.includes('api_key_invalid') ||
            errorMessage.includes('quota') || 
            errorMessage.includes('rate limit') || 
            errorMessage.includes('exceeded')) {
          
          // Set mock mode and get a mock response
          this.isApiKeyValid = false;
          this.useMockMode = true;
          
          if (errorMessage.includes('api key expired') || errorMessage.includes('invalid api key')) {
            this.apiKeyErrorMessage = 'The Gemini API key has expired. Please contact the administrator to renew it.';
          } else if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
            this.apiKeyErrorMessage = 'The Gemini API quota has been exceeded. Please try again later or contact the administrator.';
          }
          
          console.warn('Switching to mock mode due to API key issue:', this.apiKeyErrorMessage);
          
          // Return a mock response
          const mockResponse = this.getMockResponse(message);
          
          // Add to history
          this.addMessageToHistory({
            role: 'user',
            parts: [{ text: message }],
          });
          
          this.addMessageToHistory({
            role: 'model',
            parts: [{ text: mockResponse }],
          });
          
          return `${mockResponse}\n\n(Note: I've switched to offline mode. ${this.apiKeyErrorMessage})`;
        }
      }
      
      // For other errors, use standard error handling
      this.handleApiError(error);
      return 'I apologize, but I encountered an error processing your request. Please try again later.';
    }
  }

  /**
   * Interact with Notion via Gemini
   */
  public async notionAction(
    userQuery: string,
    params: NotionActionParams
  ): Promise<string> {
    // If in mock mode, return a specialized Notion mock response
    if (this.useMockMode) {
      let mockResponse = "";
      
      switch (params.action) {
        case 'create':
          mockResponse = `I would create a new ${params.resourceType} in your Notion workspace with the details you provided.`;
          break;
        case 'read':
          mockResponse = `I would retrieve the ${params.resourceType}${params.resourceId ? ` with ID ${params.resourceId}` : ''} from your Notion workspace.`;
          break;
        case 'update':
          mockResponse = `I would update the ${params.resourceType}${params.resourceId ? ` with ID ${params.resourceId}` : ''} in your Notion workspace.`;
          break;
        case 'delete':
          mockResponse = `I would delete the ${params.resourceType}${params.resourceId ? ` with ID ${params.resourceId}` : ''} from your Notion workspace.`;
          break;
        case 'search':
          mockResponse = `I would search for ${params.resourceType}s in your Notion workspace.`;
          break;
        case 'list':
          mockResponse = `I would list all ${params.resourceType}s in your Notion workspace.`;
          break;
        default:
          mockResponse = "I would help you with your Notion workspace.";
      }
      
      return `${mockResponse}\n\n(Note: I'm currently operating in offline mode. ${this.apiKeyErrorMessage})`;
    }
    
    // Create a structured prompt for Notion actions that includes system instructions
    const structuredPrompt = `
${this.systemInstruction}

When the user asks about Notion, use the Notion MCP tool to interact with their Notion workspace.
Format your responses in a clear, readable way.

User is asking about Notion: "${userQuery}"

Please use the Notion MCP tool to ${params.action} a ${params.resourceType}${
      params.resourceId ? ` with ID ${params.resourceId}` : ''
    }.
${params.data ? `Use the following data: ${JSON.stringify(params.data, null, 2)}` : ''}

Respond with the result in a user-friendly format.
    `;

    // Send the structured prompt to Gemini without systemInstruction parameter
    return this.sendMessage(structuredPrompt);
  }

  /**
   * Interact with Discord via Gemini
   */
  public async discordAction(
    userQuery: string,
    params: DiscordActionParams
  ): Promise<string> {
    // If in mock mode, return a specialized Discord mock response
    if (this.useMockMode) {
      let mockResponse = "";
      
      switch (params.action) {
        case 'read':
          mockResponse = `I would read the last ${params.limit || 10} messages from ${
            params.channelId ? `channel ${params.channelId}` : 'the current channel'
          }.`;
          break;
        case 'send':
          mockResponse = `I would send a message to ${
            params.channelId ? `channel ${params.channelId}` : 'the current channel'
          } with the content you provided.`;
          break;
        case 'summarize':
          mockResponse = `I would summarize the conversation in ${
            params.channelId ? `channel ${params.channelId}` : 'the current channel'
          }.`;
          break;
        default:
          mockResponse = "I would help you with your Discord channels and messages.";
      }
      
      return `${mockResponse}\n\n(Note: I'm currently operating in offline mode. ${this.apiKeyErrorMessage})`;
    }
    
    // Create a structured prompt for Discord actions that includes system instructions
    const structuredPrompt = `
${this.systemInstruction}

When the user asks about Discord, help them interact with their Discord channels and messages.

User is asking about Discord: "${userQuery}"

I need to ${params.action} ${
      params.action === 'read'
        ? `the last ${params.limit || 10} messages from ${
            params.channelId ? `channel ${params.channelId}` : 'the current channel'
          }`
        : params.action === 'send'
        ? `a message to ${
            params.channelId ? `channel ${params.channelId}` : 'the current channel'
          } with content: "${params.content}"`
        : params.action === 'summarize'
        ? `and provide a summary of the conversation in ${
            params.channelId ? `channel ${params.channelId}` : 'the current channel'
          }`
        : ''
    }

Respond with the result in a user-friendly format.
    `;

    // Send the structured prompt to Gemini
    return this.sendMessage(structuredPrompt);
  }

  /**
   * Interact with Google Calendar via Gemini
   */
  public async calendarAction(
    userQuery: string,
    params: CalendarActionParams
  ): Promise<string> {
    // If in mock mode, return a specialized Calendar mock response
    if (this.useMockMode) {
      let mockResponse = "";
      
      switch (params.action) {
        case 'list':
          mockResponse = `I would list your events from ${params.timeMin || 'today'} to ${params.timeMax || 'next week'}.`;
          break;
        case 'create':
          mockResponse = `I would create a new event in your calendar with the details you provided.`;
          break;
        case 'update':
          mockResponse = `I would update event ${params.eventId} with the new details you provided.`;
          break;
        case 'delete':
          mockResponse = `I would delete event ${params.eventId} from your calendar.`;
          break;
        default:
          mockResponse = "I would help you manage your Google Calendar events and schedule.";
      }
      
      return `${mockResponse}\n\n(Note: I'm currently operating in offline mode. ${this.apiKeyErrorMessage})`;
    }
    
    // Create a structured prompt for Calendar actions that includes system instructions
    const structuredPrompt = `
${this.systemInstruction}

When the user asks about Google Calendar, help them manage their events and schedule.

User is asking about their Google Calendar: "${userQuery}"

I need to ${params.action} ${
      params.action === 'list'
        ? `events from ${params.timeMin || 'today'} to ${params.timeMax || 'next week'}`
        : params.action === 'create'
        ? `a new event: ${JSON.stringify(params.eventData, null, 2)}`
        : params.action === 'update'
        ? `event ${params.eventId} with new details: ${JSON.stringify(
            params.eventData,
            null,
            2
          )}`
        : params.action === 'delete'
        ? `event ${params.eventId}`
        : ''
    }

Respond with the result in a user-friendly format.
    `;

    // Send the structured prompt to Gemini
    return this.sendMessage(structuredPrompt);
  }

  /**
   * Detect intent from user message
   * This helps route the message to the appropriate handler
   */
  public async detectIntent(message: string): Promise<{
    intent: 'notion' | 'discord' | 'calendar' | 'general';
    confidence: number;
    action?: string;
    params?: Record<string, any>;
  }> {
    // If in mock mode, use a simple rule-based intent detection
    if (this.useMockMode) {
      // Simple keyword-based intent detection for mock mode
      const lowerMessage = message.toLowerCase();
      
      if (lowerMessage.includes('notion') || 
          lowerMessage.includes('page') || 
          lowerMessage.includes('database') || 
          lowerMessage.includes('task')) {
        return {
          intent: 'notion',
          confidence: 0.8,
          action: lowerMessage.includes('create') ? 'create' : 
                  lowerMessage.includes('read') || lowerMessage.includes('get') ? 'read' : 
                  lowerMessage.includes('update') ? 'update' : 
                  lowerMessage.includes('delete') ? 'delete' : 
                  lowerMessage.includes('search') ? 'search' : 'list',
          params: {
            resourceType: lowerMessage.includes('database') ? 'database' : 'page'
          }
        };
      } else if (lowerMessage.includes('discord') || 
                lowerMessage.includes('channel') || 
                lowerMessage.includes('message')) {
        return {
          intent: 'discord',
          confidence: 0.8,
          action: lowerMessage.includes('send') ? 'send' : 
                  lowerMessage.includes('summarize') ? 'summarize' : 'read',
          params: {}
        };
      } else if (lowerMessage.includes('calendar') || 
                lowerMessage.includes('event') || 
                lowerMessage.includes('schedule') || 
                lowerMessage.includes('meeting')) {
        return {
          intent: 'calendar',
          confidence: 0.8,
          action: lowerMessage.includes('create') ? 'create' : 
                  lowerMessage.includes('update') ? 'update' : 
                  lowerMessage.includes('delete') ? 'delete' : 'list',
          params: {}
        };
      } else {
        return {
          intent: 'general',
          confidence: 0.5
        };
      }
    }
    
    try {
      // Include intent classification instructions in the prompt itself
      // instead of using systemInstruction parameter
      const prompt = `
You are an intent classification system. Analyze the user's message and respond ONLY with a valid JSON object containing the intent classification. Do not include any other text.

Analyze the following user message and determine the user's intent.
User message: "${message}"

Classify the intent into one of these categories:
1. notion - User wants to interact with Notion (pages, databases, tasks)
2. discord - User wants to interact with Discord (messages, channels)
3. calendar - User wants to interact with Google Calendar (events, meetings)
4. general - General query not related to specific tools

Respond in JSON format with:
- intent: The category (notion, discord, calendar, general)
- confidence: Number between 0-1 indicating confidence
- action: The specific action user wants to perform
- params: Any parameters needed for the action

Example response:
{
  "intent": "notion",
  "confidence": 0.95,
  "action": "create",
  "params": {
    "resourceType": "page",
    "title": "Meeting Notes"
  }
}
      `;

      const response = await this.sendMessage(prompt, {
        temperature: 0.1, // Low temperature for more deterministic results
      });

      try {
        // Extract a pure JSON string from the model response (it might be wrapped
        // in markdown fences such as ```json ... ```)
        const jsonText = this.extractJson(response);

        // Try to parse the extracted string as JSON
        const parsedResponse = JSON.parse(jsonText);
        return parsedResponse;
      } catch (e) {
        // If parsing fails, return a default response
        console.error("Failed to parse intent detection response");
        console.error("Raw response from model:", response);
        console.error(e);
        return {
          intent: 'general',
          confidence: 0.5,
        };
      }
    } catch (error) {
      console.error("Error detecting intent", error);
      return {
        intent: 'general',
        confidence: 0.5,
      };
    }
  }

  /**
   * Extract JSON from a Gemini response that may be wrapped in markdown
   * code-fences.  Returns the best-guess JSON string (trimmed).
   */
  private extractJson(responseText: string): string {
    const trimmed = responseText.trim();

    // Try ```json ... ``` or ``` ...
    const fencedMatch = trimmed.match(/```(?:json)?\\s*([\\s\\S]*?)```/i);
    if (fencedMatch && fencedMatch[1]) {
      return fencedMatch[1].trim();
    }

    // Fallback: take substring from first { to last }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return trimmed.substring(firstBrace, lastBrace + 1).trim();
    }

    // As a last resort, return the original text
    return trimmed;
  }

  /**
   * Process a user message and route it to the appropriate handler based on intent
   */
  public async processMessage(message: string): Promise<string> {
    try {
      // Create a message that includes system instructions
      const enhancedMessage = `
${this.systemInstruction}

User message: "${message}"

Please respond to the user's message in a helpful, concise, and friendly manner.
      `;
      
      // Detect the user's intent
      const intentResult = await this.detectIntent(message);
      
      // Route based on intent
      switch (intentResult.intent) {
        case 'notion':
          if (intentResult.action && intentResult.params) {
            return this.notionAction(message, {
              action: intentResult.action as any,
              resourceType: intentResult.params.resourceType || 'page',
              resourceId: intentResult.params.resourceId,
              data: intentResult.params.data,
            });
          } else {
            // Notion intent but no specific action – still remind model it has access
            const authContextPrompt = `
${this.systemInstruction}

REMINDER: You already have authenticated access to the user's Notion workspace and should never ask for authentication credentials.

User message: "${message}"

Please respond accordingly without requesting any tokens.
            `;
            return this.sendMessage(authContextPrompt);
          }
          break;
        
        case 'discord':
          if (intentResult.action && intentResult.params) {
            return this.discordAction(message, {
              action: intentResult.action as any,
              channelId: intentResult.params.channelId,
              messageId: intentResult.params.messageId,
              content: intentResult.params.content,
              limit: intentResult.params.limit,
            });
          }
          break;
        
        case 'calendar':
          if (intentResult.action && intentResult.params) {
            return this.calendarAction(message, {
              action: intentResult.action as any,
              eventId: intentResult.params.eventId,
              timeMin: intentResult.params.timeMin,
              timeMax: intentResult.params.timeMax,
              eventData: intentResult.params.eventData,
            });
          }
          break;
      }
      
      // Default to general message handling with enhanced message
      return this.sendMessage(enhancedMessage);
    } catch (error) {
      console.error("Error processing message", error);
      
      // If we're in mock mode, return a friendly error message
      if (this.useMockMode) {
        return `I'm here to help with your Notion, Discord, and Google Calendar needs. However, I'm currently operating in offline mode due to an API connection issue. ${this.apiKeyErrorMessage} How can I assist you with information about these integrations?`;
      }
      
      return "I encountered an error processing your request. Please try again.";
    }
  }

  /**
   * Helper method to prepare messages for Gemini API
   */
  private prepareMessages(): GeminiMessage[] {
    // If we're in mock mode, return a minimal history to avoid API calls
    if (this.useMockMode) {
      // Just return what we have without trying to initialize with API calls
      if (this.conversationHistory.length === 0) {
        // Add a minimal history for consistency
        this.addMessageToHistory({
          role: 'user',
          parts: [{ text: 'Hello' }]
        });
        
        this.addMessageToHistory({
          role: 'model',
          parts: [{ text: "I'm ready to assist you with Notion, Discord, and Google Calendar. How can I help you today?" }]
        });
      }
      
      return this.conversationHistory.slice(-this.maxHistoryLength);
    }
    
    // If we have no history yet, initialize with system instruction as first user message
    if (this.conversationHistory.length === 0 && this.systemInstruction) {
      this.addMessageToHistory({
        role: 'user',
        parts: [{ text: this.systemInstruction }]
      });
      
      // Add a model response to maintain the conversation flow
      this.addMessageToHistory({
        role: 'model',
        parts: [{ text: "I'm ready to assist you with Notion, Discord, and Google Calendar. How can I help you today?" }]
      });
    }
    
    // Return only the most recent messages to stay within context limits
    return this.conversationHistory.slice(-this.maxHistoryLength);
  }

  /**
   * Helper method to add a message to the conversation history
   */
  private addMessageToHistory(message: GeminiMessage): void {
    this.conversationHistory.push(message);
    
    // Trim history if it exceeds max length
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  /**
   * Helper method to handle API errors
   */
  private handleApiError(error: any): void {
    console.error('Gemini API Error:', error);
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      
      // Check for API key related errors
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('api key expired') || 
          errorMessage.includes('invalid api key') || 
          errorMessage.includes('api_key_invalid') ||
          errorMessage.includes('quota') || 
          errorMessage.includes('rate limit') || 
          errorMessage.includes('exceeded')) {
        
        // Set mock mode for future requests
        this.isApiKeyValid = false;
        this.useMockMode = true;
        
        if (errorMessage.includes('api key expired') || errorMessage.includes('invalid api key')) {
          this.apiKeyErrorMessage = 'The Gemini API key has expired. Please contact the administrator to renew it.';
        } else if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
          this.apiKeyErrorMessage = 'The Gemini API quota has been exceeded. Please try again later or contact the administrator.';
        }
        
        console.warn('Switching to mock mode due to API key issue:', this.apiKeyErrorMessage);
      }
    }
    
    if (error.response) {
      console.error('Response error:', error.response);
    }
  }
}

export default GeminiService;
