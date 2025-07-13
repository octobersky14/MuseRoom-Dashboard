import { GoogleGenerativeAI, GenerativeModel, Part, Tool } from '@google/generative-ai';

// Define interfaces for Gemini API
interface GeminiMessage {
  role: 'user' | 'model' | 'system';
  parts: Part[];
}

interface GeminiRequestOptions {
  temperature?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
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

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });

    // Set default system instruction
    this.systemInstruction = `You are an AI assistant integrated into the MuseRoom Dashboard. 
You can help users with Notion, Discord, and Google Calendar. 
You should be helpful, concise, and friendly. 
When users ask about their Notion workspace, Discord messages, or calendar events, 
try to provide the most relevant information and assist with any tasks they need help with.`;
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
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });
  }

  /**
   * Clear conversation history
   */
  public clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Send a message to Gemini and get a response
   */
  public async sendMessage(
    message: string,
    options: GeminiRequestOptions = {}
  ): Promise<string> {
    try {
      // Add user message to history
      this.addMessageToHistory({
        role: 'user',
        parts: [{ text: message }],
      });

      // Prepare messages for Gemini API
      const chat = this.model.startChat({
        history: this.prepareMessages(),
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxOutputTokens ?? 1024,
        },
        systemInstruction: options.systemInstruction ?? this.systemInstruction,
        tools: options.tools,
      });

      // Generate response
      const result = await chat.sendMessage(message);
      const response = result.response;
      const responseText = response.text();

      // Add model's response to history
      this.addMessageToHistory({
        role: 'model',
        parts: [{ text: responseText }],
      });

      return responseText;
    } catch (error) {
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
    // Create a structured prompt for Notion actions
    const structuredPrompt = `
User is asking about Notion: "${userQuery}"

Please use the Notion MCP tool to ${params.action} a ${params.resourceType}${
      params.resourceId ? ` with ID ${params.resourceId}` : ''
    }.
${params.data ? `Use the following data: ${JSON.stringify(params.data, null, 2)}` : ''}

Respond with the result in a user-friendly format.
    `;

    // Send the structured prompt to Gemini
    return this.sendMessage(structuredPrompt, {
      // Include system instruction that encourages Gemini to use Notion MCP
      systemInstruction: `${this.systemInstruction} When the user asks about Notion, use the Notion MCP tool to interact with their Notion workspace. Format your responses in a clear, readable way.`,
    });
  }

  /**
   * Interact with Discord via Gemini
   */
  public async discordAction(
    userQuery: string,
    params: DiscordActionParams
  ): Promise<string> {
    // Create a structured prompt for Discord actions
    const structuredPrompt = `
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
    // Create a structured prompt for Calendar actions
    const structuredPrompt = `
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
    try {
      const prompt = `
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
        systemInstruction: "You are an intent classification system. Analyze the user's message and respond ONLY with a valid JSON object containing the intent classification. Do not include any other text.",
        temperature: 0.1, // Low temperature for more deterministic results
      });

      try {
        // Try to parse the response as JSON
        const parsedResponse = JSON.parse(response.trim());
        return parsedResponse;
      } catch (e) {
        // If parsing fails, return a default response
        console.error("Failed to parse intent detection response", e);
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
   * Process a user message and route it to the appropriate handler based on intent
   */
  public async processMessage(message: string): Promise<string> {
    try {
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
      
      // Default to general message handling
      return this.sendMessage(message);
    } catch (error) {
      console.error("Error processing message", error);
      return "I encountered an error processing your request. Please try again.";
    }
  }

  /**
   * Helper method to prepare messages for Gemini API
   */
  private prepareMessages(): GeminiMessage[] {
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
    
    if (error.message) {
      console.error('Error message:', error.message);
    }
    
    if (error.response) {
      console.error('Response error:', error.response);
    }
  }
}

export default GeminiService;
