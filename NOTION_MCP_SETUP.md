# Notion MCP Integration — Setup Guide

Welcome to the “Model-Context-Protocol” (MCP) era for Notion!  
This document will walk you through everything you need to connect MuseRoom to your workspace—whether you want the **official streaming endpoint**, a **simple local proxy**, or **pure offline development**.

---

## 1. What *is* Notion MCP?

Model-Context-Protocol is Notion’s new, SSE-based interface built for AI agents.  
Compared with the classic REST API it offers:

* Server-Sent Events (bidirectional) – near-real-time updates with minimal latency  
* Unified “tool” schema – pages, databases, comments, users all described the same way  
* Dramatically fewer round-trips – single request can bundle context + action  
* Simpler auth flow – a single OAuth grant scoped for agent actions  
* Streaming responses – perfect for conversational UIs (like MuseRoom)  

In short: **MCP lets the Voice Agent feel instant and context-aware while cutting API complexity.**

---

## 2. Three Connection Modes

MuseRoom supports three interchangeable modes. Switch by changing **one env variable** and restarting Vite.

| Mode | When to use | How it works |
|------|-------------|--------------|
| **Direct MCP (recommended)** | You have access to Notion’s beta SSE endpoint and your firewall allows outbound SSE. | The front-end opens an OAuth window once, then streams requests to `https://mcp.notion.com/sse`. |
| **Local Proxy (fallback)** | Browsers forbid direct calls (CORS) or corporate network blocks SSE. | An Express server on `localhost:3005` forwards classic REST calls. |
| **Offline Mock** | No Internet, expired API key, demo on a plane. | All MCP calls return deterministic mock data so the UI never breaks. |

### 2.1 Direct MCP

1. Ensure you’re whitelisted for the MCP beta.  
2. In `.env` set  
   ```
   VITE_NOTION_MCP_MODE=direct
   ```  
3. Run the app (`npm run dev`).  
4. On first MCP call a Notion OAuth popup appears – approve access.  
5. You’re in! `Connection: Connected ✓`, `Auth: Authenticated ✓` in the UI banners.

### 2.2 Local Proxy

1. Make sure you have a Notion internal integration token (same as legacy REST).  
2. Set  
   ```
   VITE_NOTION_MCP_MODE=proxy
   ```  
3. Start the proxy:  
   ```bash
   node server.js          # listens on http://localhost:3005/api/notion
   ```  
4. Optional: edit `.env` → `ALLOWED_ORIGINS=http://localhost:3000` if port differs.  
5. Reload the front-end. The banner will read “Using Fallback Service”.

### 2.3 Offline Mode

* Quick UI toggle – **Enable Offline** button inside the Notion MCP demo card.  
* Or pre-set in `.env`:  
  ```
  VITE_NOTION_MCP_MODE=offline
  ```  

Mock pages, databases, comments and users are generated in memory; nothing leaves your machine.

---

## 3. Environment Variables

Add these keys to your local `.env` (keep any existing ones):

```
# ── Notion MCP ───────────────────────────────────────────
# Choose: direct | proxy | offline
VITE_NOTION_MCP_MODE=direct

# Official SSE endpoint – leave as default unless Notion tells you otherwise
VITE_NOTION_MCP_URL=https://mcp.notion.com/sse

# REST integration token (needed for proxy + mock)
VITE_NOTION_API_KEY=secret_xxx

# Local proxy base (proxy mode only)
VITE_NOTION_PROXY_URL=http://localhost:3005/api/notion
```

Proxy server also reads:

```
ALLOWED_ORIGINS=http://localhost:3000
NOTION_API_KEY=secret_xxx
PORT=3005
```

---

## 4. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `Connection Status: ERROR` right after load | SSE blocked by firewall | Switch to `proxy` mode. |
| OAuth window opens but stays blank | Third-party cookies blocked | Allow cookies for notion.com or use proxy mode. |
| `Auth Status: ERROR` after approving OAuth | Beta access revoked/expired | Re-request MCP beta or fall back to proxy. |
| CORS 403 when proxying | `ALLOWED_ORIGINS` mismatch | Update `.env` in `server.js` side. |
| “Operating in offline mode” banner appears unexpectedly | Gemini or Notion API key invalid / quota | Add fresh keys or remain in offline for demo. |

Detailed matrix lives in `TROUBLESHOOTING.md`.

---

## 5. Verifying the Integration

1. Open the app → **Notion MCP** tab.  
2. Watch the badges – you want **Connected** + **Authenticated**.  
3. Type “dashboard” in *Search* and hit Enter.  
   • Results list should populate (direct/ proxy) or show mock pages (offline).  
4. Click a page → the *View* tab renders title & markdown content.  
5. Create: go to *Create* tab, enter “Test Page”, click **Create Page**.  
   • Success toast appears. Refresh search – new page present.  
6. Comments: select page → *Comments* tab → write “Hello from MCP” → **Add Comment**.  
   • Comment card shows instantly.

If every step works you’re fully MCP-enabled. 🎉

---

Happy building!
