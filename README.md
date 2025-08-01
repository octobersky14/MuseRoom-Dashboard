# MuseRoom Voice Agent

A modern voice-enabled web application that lets you run your work from one place with help from AI. Built with React, Vite, and advanced voice recognition technology.

## Features

- 🎤 **Voice Recognition** – talk to the AI using your microphone
- 🔊 **Text-to-Speech** – AI responds with premium ElevenLabs voices or browser TTS
- 💬 **AI Chat Integration** – Powerful n8n-powered chat interface with file uploads and custom workflows
- 📡 **Discord Integration** – read and send summaries of Discord messages via n8n webhook
- 📄 **Notion Integration (MCP)** – Native **Notion MCP** support with three connection modes (direct MCP, local proxy, or offline mock) for searching, reading and updating pages & databases
- 📅 **Google Calendar (beta)** – list and manage events with natural-language commands
- 🎨 **Modern UI** – beautiful, responsive design with Tailwind CSS
- 📱 **Real-time Updates** – live conversation history and message display
- 🌓 **Dark/Light Mode** – toggle between themes
- ⚡ **Fast Performance** – built with Vite for an optimal dev experience
- 🛡️ **Automatic Offline Mode** – falls back to local mock responses when external APIs are unavailable, with clear visual indicators

## Tech Stack

_(unchanged – list trimmed for brevity)_

## Quick Start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create environment file**

   ```bash
   cp env.example .env
   ```

3. **Start the dev server**

   ```bash
   npm run dev
   ```

4. Open your browser at **http://localhost:3000**

### Connect to Notion MCP

MuseRoom can talk to Notion in three different ways. Pick the one that fits your workflow:

| Mode                            | When to use                                                                    | How to enable                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **A. Direct MCP (recommended)** | You have access to the official beta endpoint `https://mcp.notion.com/sse`     | Set `VITE_NOTION_MCP_MODE=direct` (default) – the app opens an OAuth window the first time you connect.                           |
| **B. Local Proxy (fallback)**   | Running entirely in the browser or behind a corporate firewall that blocks SSE | 1) `npm run proxy` (`node server.js`)  2) Set `VITE_NOTION_MCP_MODE=proxy` – the app talks to `http://localhost:3005/api/notion`. |
| **C. Offline Mock**             | Travelling, no internet, or API quota exceeded                                 | Click **Enable Offline** inside the UI or set `VITE_NOTION_MCP_MODE=offline`. The assistant returns mock data only.               |

> 💡 You can switch modes at any time—no code changes required, just update the env var and restart Vite.

## Voice Commands

_(unchanged)_

## Environment Variables

Add the following to your `.env` (only new lines shown – keep existing ones):

```env
# ── n8n Chat Integration ───────────────────────────────────
# Get your webhook URL from your n8n workflow with a Chat Trigger node
VITE_WEBHOOK_URL=https://your-instance.app.n8n.cloud/webhook/your-webhook-id

# ── Notion MCP ─────────────────────────────────────────────
# Choose connection mode: direct | proxy | offline
VITE_NOTION_MCP_MODE=direct

# Direct MCP endpoint – normally leave as default
VITE_NOTION_MCP_URL=https://mcp.notion.com/sse

# Notion internal integration token (used for proxy & offline fallback)
VITE_NOTION_API_KEY=your_notion_internal_integration_token

# Local proxy base (only needed in proxy mode)
VITE_NOTION_PROXY_URL=http://localhost:3005/api/notion
```

_(rest of env table unchanged)_

## Setup notes for each mode

1. **Direct MCP** – nothing to install. First call will pop an OAuth window; approve access and you’re done.
2. **Proxy** – run:

   ```bash
   node server.js          # starts CORS proxy on port 3005
   ```

   Make sure `ALLOWED_ORIGINS` in `.env` contains your front-end URL.

3. **Offline** – enable via UI **or** set `VITE_NOTION_MCP_MODE=offline`. No external calls are made; the AI responds with safe mock data.

## AI Chat Setup

The MuseRoom Dashboard includes a powerful AI chat interface powered by n8n workflows. To get started:

1. **Quick Setup**: Run `./setup-n8n-chat.sh` for guided configuration
2. **Manual Setup**: Follow the detailed guide in `N8N_INTEGRATION.md`
3. **Create Workflow**: Set up an n8n workflow with Chat Trigger → AI Agent → Respond to Webhook
4. **Configure**: Add your webhook URL to the environment variables

The chat supports:

- **Embedded Widget**: Integrated into the main dashboard
- **Fullscreen Mode**: Dedicated chat page at `/chat`
- **File Uploads**: Images, PDFs, and text files
- **Custom Styling**: Matches the MuseRoom theme

## Troubleshooting

See `TROUBLESHOOTING.md` for a detailed matrix of MCP modes, common errors, and recovery steps.

For n8n chat issues, see `N8N_INTEGRATION.md` for troubleshooting and advanced configuration.

_(rest of README unchanged)_
