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
      return "I encountered an error processing your request. Please try again.";
    }
  }

  /**
   * Helper method to prepare messages for Gemini API
   */
  private prepareMessages(): GeminiMessage[] {
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
    
    if (error.message) {
      console.error('Error message:', error.message);
    }
    
    if (error.response) {
      console.error('Response error:', error.response);
    }
  }
}

export default GeminiService;
