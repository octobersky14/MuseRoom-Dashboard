# MuseRoom Dashboard — Integration Status (July 14 2025)

## 1. Current State

| Component | Mode | Status | Notes |
|-----------|------|--------|-------|
| **Gemini 1.5 Flash** | API → `geminiService.ts` | 🟥 **Offline / Mock** | Quota exhausted → service is automatically serving mock responses until a valid key is available. |
| **Notion** | Dual-mode (MCP → Proxy) | 🟩 **Online (Proxy)** | Direct MCP (`https://mcp.notion.com/sse`) fails (likely beta access), service falls back to local proxy `http://localhost:3005/api/notion` which is returning real workspace data. |

## 2. Fixes Applied

| Date | Area | Fix | Result |
|------|------|-----|--------|
| 14 Jul 2025 | Proxy server (`server.js`) | • Normalised incoming path to strip duplicate `v1/` segment.<br>• Added health endpoint `/health`.<br>• Improved Axios error forwarding. | Proxy now routes `…/api/notion/v1/*` → `https://api.notion.com/v1/*` correctly (verified with live data). |
| 14 Jul 2025 | `.env` | Set `VITE_NOTION_PROXY_URL=http://localhost:3005/api/notion` and `VITE_NOTION_MCP_URL=https://mcp.notion.com/sse`. | Front-end no longer calls port 4000; CORS errors gone. |
| 14 Jul 2025 | `notionMcpService.ts` | Added 5 s timeout + automatic fallback to proxy with detailed logging. | Seamless switch to proxy when MCP unavailable. |
| Earlier | `geminiService.ts` | Singleton pattern + cooldown; automatic switch to mock mode when 429 or key missing. | Prevented infinite token drain and keeps UI responsive. |

## 3. What to Expect After Refresh

1. **Gemini**  
   • Welcome / chat replies will carry the “(offline mock)” flavour until a fresh API key or quota is supplied.  
   • Once a valid key is set in `.env` **and** the page is reloaded, real answers resume automatically.

2. **Notion**  
   • Data panels (pages, databases, tasks, etc.) should load almost immediately via the proxy.  
   • First the app attempts a short MCP handshake (5 s). If it fails you’ll see a console message _“[NotionMCP] Falling back to local proxy…”_ and then real data populates from the proxy.

3. **Hot-reloading**  
   • Vite watches `.env`; any change (e.g. new Gemini key) triggers an automatic rebuild so only a browser refresh is needed.

## 4. Next Steps / Troubleshooting

| Symptom | Action |
|---------|--------|
| Gemini replies stay in mock mode | 1. Obtain new API key / wait for quota reset.<br>2. Add `VITE_GEMINI_API_KEY=YOUR_KEY` to `.env`.<br>3. Refresh page. |
| Browser still hits port 4000 | Clear browser cache or run `pnpm dev` again – ensure `.env` is reloaded. |
| Proxy refuses connection | • Run `node server.js` (should log “Notion API proxy server running on http://localhost:3005”).<br>• Check no other process is occupying port 3005. |
| Want to test direct MCP again | Set `VITE_NOTION_MCP_MODE=direct`, restart proxy & front-end, ensure you have MCP beta access. |
| Health check | `curl http://localhost:3005/health` → `{"status":"ok"}`. |

---

_Maintained by Factory Assistant – last update 2025-07-14._
