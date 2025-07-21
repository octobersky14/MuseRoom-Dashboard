# n8n Chat Integration Guide

This guide will help you set up and configure the n8n chat integration for your MuseRoom Dashboard.

## Overview

The MuseRoom Dashboard now includes a powerful AI chat interface powered by n8n workflows. This allows you to create custom AI assistants that can interact with your workspace data, automate tasks, and provide intelligent responses.

## Features

- **Modern Liquid Glass Design**: Sleek, glassmorphism chat interface with backdrop blur effects
- **Embedded Chat Widget**: Seamlessly integrated into the dashboard with beautiful animations
- **Fullscreen Chat Mode**: Dedicated chat page for immersive conversations
- **Real-time Messaging**: Instant message delivery with loading states and error handling
- **Connection Status**: Visual indicator showing webhook connection status
- **Custom Styling**: Matches the MuseRoom theme with purple/pink gradients
- **Responsive Design**: Works perfectly on all screen sizes
- **Smooth Animations**: Framer Motion powered transitions and micro-interactions

## Setup Instructions

### 1. Create an n8n Workflow

1. **Sign up for n8n Cloud** (recommended) or install n8n locally

   - Cloud: https://cloud.n8n.io/
   - Local: https://docs.n8n.io/hosting/installation/

2. **Create a new workflow** with the following structure:

   ```
   Chat Trigger → AI Agent → AI Memory → Respond to Webhook
   ```

3. **Add a Chat Trigger node**:

   - This is the entry point for chat messages
   - Configure the "Allowed Origins (CORS)" field with your domain:
     - Development: `http://localhost:5173`
     - Production: `https://your-domain.com`

4. **Add an AI Agent node**:

   - Connect to your preferred AI service (OpenAI, Anthropic, etc.)
   - Configure the agent with your workspace context
   - Set up tools and capabilities

5. **Add an AI Memory node** (optional):

   - Enables conversation history
   - Helps maintain context across messages

6. **Add a Respond to Webhook node**:
   - This sends the AI response back to the chat interface

### 2. Configure Environment Variables

1. **Copy the environment template**:

   ```bash
   cp env.example .env
   ```

2. **Add your n8n webhook URL**:

   ```bash
   VITE_WEBHOOK_URL=https://your-instance.app.n8n.cloud/webhook/your-webhook-id
   ```

3. **For local development**:
   ```bash
   VITE_WEBHOOK_URL=http://localhost:5678/webhook/your-webhook-id
   ```

### 3. Webhook Payload Format

The chat component sends messages to your n8n webhook in this format:

```json
{
  "action": "sendMessage",
  "chatInput": "User's message here",
  "sessionId": "museroom-session"
}
```

Your n8n workflow should respond with:

```json
{
  "response": "AI assistant's response here"
}
```

### 4. Activate the Workflow

1. **Save your workflow** in n8n
2. **Activate the workflow** (toggle the switch)
3. **Copy the webhook URL** from the Chat Trigger node
4. **Update your environment variables** with the webhook URL

## Usage

### Dashboard Integration

The chat widget is automatically integrated into the main dashboard:

1. **Navigate to the Dashboard** (`/`)
2. **Scroll down** to the "AI Assistant" section
3. **Click the chat widget** to start a conversation
4. **Type your message** and press Enter or click Send

### Fullscreen Chat

For a more immersive experience:

1. **Click "AI Chat"** in the sidebar navigation
2. **Use the fullscreen chat interface**
3. **Navigate back** using the "Back to Dashboard" button

### Real-time Features

The chat includes several real-time features:

- **Connection Status**: Visual indicator showing if the webhook is connected
- **Loading States**: Animated loading indicator while AI is processing
- **Error Handling**: Graceful error messages when connection fails
- **Auto-scroll**: Messages automatically scroll to the bottom
- **Timestamps**: Each message shows when it was sent

## Customization

### Styling

The chat widget uses Tailwind CSS classes with glassmorphism effects. You can customize the styling by modifying the classes in `src/components/N8nChat.tsx`:

```tsx
// Message bubbles
className={`max-w-[80%] rounded-2xl px-4 py-3 backdrop-blur-xl border ${
  message.role === 'user'
    ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30 text-white'
    : 'bg-white/10 border-white/20 text-white'
}`}

// Input field
className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-gray-400 backdrop-blur-xl focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
```

### Configuration

Modify the chat configuration in `src/config/n8n.ts`:

```typescript
export const n8nConfig = {
  webhookUrl: import.meta.env.VITE_WEBHOOK_URL || "",
  chat: {
    mode: "window", // 'window' | 'fullscreen'
    showWelcomeScreen: true,
    allowFileUploads: true,
    allowedFilesMimeTypes: "image/*,application/pdf,text/*",
  },
  ui: {
    title: "MuseRoom AI Assistant",
    subtitle: "Your intelligent workspace companion",
    placeholder: "Ask me anything about your workspace...",
  },
};
```

## Advanced Workflow Examples

### Basic AI Assistant

```javascript
// Chat Trigger → AI Agent → Respond to Webhook
{
  "prompt": "You are a helpful AI assistant for the MuseRoom workspace. Help users with their questions about music production, project management, and creative workflows.",
  "model": "gpt-4",
  "temperature": 0.7
}
```

### Workspace-Aware Assistant

```javascript
// Chat Trigger → AI Agent → Notion → AI Memory → Respond to Webhook
{
  "prompt": "You have access to the user's Notion workspace. Help them find documents, create new pages, and manage their projects.",
  "tools": ["notion_search", "notion_create_page", "notion_update_page"]
}
```

### Multi-Service Integration

```javascript
// Chat Trigger → AI Agent → Discord → Notion → Calendar → AI Memory → Respond to Webhook
{
  "prompt": "You can help users manage their Discord messages, Notion documents, and calendar events. Provide comprehensive workspace assistance.",
  "tools": ["discord_send_message", "notion_search", "calendar_create_event"]
}
```

## Troubleshooting

### Common Issues

1. **Chat not loading**:

   - Check that the webhook URL is correct
   - Verify the n8n workflow is active
   - Check browser console for errors

2. **CORS errors**:

   - Ensure your domain is added to "Allowed Origins" in the Chat Trigger node
   - Check that you're using the correct protocol (http/https)

3. **Messages not sending**:

   - Verify the webhook URL is accessible
   - Check n8n workflow execution logs
   - Ensure the Respond to Webhook node is configured correctly

4. **File uploads not working**:
   - Check file size limits
   - Verify MIME type restrictions
   - Ensure the workflow can handle file uploads

### Debug Mode

Enable debug logging by adding to your environment:

```bash
VITE_DEBUG_N8N=true
```

This will log webhook requests and responses to the browser console.

## Security Considerations

1. **Webhook Security**:

   - Use HTTPS in production
   - Implement webhook signature verification
   - Limit allowed origins to your domains

2. **File Upload Security**:

   - Validate file types and sizes
   - Scan uploaded files for malware
   - Store files securely

3. **API Key Management**:
   - Store API keys securely in n8n
   - Use environment variables
   - Rotate keys regularly

## Support

For issues with:

- **n8n Platform**: Check the [n8n documentation](https://docs.n8n.io/)
- **MuseRoom Integration**: Check this guide and the code comments
- **Workflow Design**: Join the [n8n community](https://community.n8n.io/)

## Next Steps

1. **Explore n8n workflows** for more advanced automation
2. **Integrate with other services** (Slack, Discord, Notion, etc.)
3. **Customize the AI agent** for your specific use cases
4. **Add more tools and capabilities** to your assistant

Happy chatting! 🚀
