# Troubleshooting Guide

This document helps you diagnose and fix the most common problems when running the MuseRoom Dashboard and its AI assistant stack (Gemini 1.5 Flash + Notion MCP proxy + Discord & Google Calendar integrations).

---

## 1. Understanding “Offline Mode”

The application automatically switches to **Offline Mode** when the Gemini API cannot be reached or an authentication/quota error occurs.  
While offline:

* The AI assistant keeps responding, but uses **local mock logic** (no live model calls).  
* No new content is pulled from Gemini, Discord, or Google Calendar.  
* Notion data **is still available** (via the local proxy) for read-only operations.

Visual cues:
* Amber “Offline Mode Active” banner at the top of the page.  
* “(Offline)” badges beside assistant messages.  
* Input placeholders and buttons turn amber.

---

## 2. Fixing Gemini API Key / Quota Issues

Problem | Likely Cause | Resolution
------- | ------------ | ----------
“API key has expired” | Key is revoked or past expiry | 1) Generate a new key in Google AI console → 2) Update `.env` → `VITE_GEMINI_API_KEY=NEW_KEY` → 3) Restart both dev server & proxy.
“Quota has been exceeded” | You hit your daily/monthly tokens | Wait for quota reset **or** upgrade plan. In the meantime, stay in Offline Mode.
“Invalid authentication credentials” | Typo or wrong project key | Copy–paste the key again, ensure no leading/trailing spaces.
Requests succeed in curl but fail in app | Key in frontend env differs from backend env | Confirm **both** `.env` files (root & server) match.

### Key Rotation Checklist

1. **Stop** the dev server (`Ctrl-C`).  
2. Create / update `.env` and `server/.env` with the fresh key.  
3. Run `npm run dev` (or `pnpm dev`) again.  
4. Confirm normal mode banner disappears.

---

## 3. Common Error Messages & Quick Fixes

Error Text in Console / Toast | Meaning | Fix
----------------------------- | --------| ---
`api key expired` / `invalid api key` | Gemini rejected auth | Replace key (see section 2).
`quota exceeded` / `rate limit` | Too many requests | Wait or decrease frequency; enable billing.
`Failed to initialize Gemini service` | Key missing in `.env` | Add `VITE_GEMINI_API_KEY`.
`Network Error` or `ECONNREFUSED :443` | Firewall / proxy blocking | Check local network, corporate VPN, or set HTTPS proxy.
`CORS policy: No ‘Access-Control-Allow-Origin’` | Browser tried to call Notion directly | Ensure you **are** calling `http://localhost:3001/notion/*` (see section 6).
`First content should be with role 'user', got system` | Out-of-date Gemini schema | Pull latest code (system instructions now embedded correctly).

---

## 4. Testing Whether API Keys Work

### Gemini

```bash
curl -H "Content-Type: application/json" \
     -H "Authorization: Bearer $VITE_GEMINI_API_KEY" \
     -d '{ "contents": [ { "parts": [ { "text": "ping" } ] } ] }' \
     https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
```

Expected JSON response contains `"text": ...`.

### Notion

```bash
curl http://localhost:3001/notion/v1/databases \
     -H "x-notion-token: $VITE_NOTION_API_KEY"
```

Should list databases. If you get a CORS message, you hit the Notion API **directly** – use the proxy URL as above.

---

## 5. Feature Matrix: Online vs Offline

Capability | Online Mode | Offline Mode
-----------|-------------|-------------
Natural language generation | ✅ Real Gemini responses | ⚠️ Mock template replies (limited)
Intent detection | ✅ Model-driven | ⚠️ Heuristic fallback
Notion read operations | ✅ | ✅
Notion create/update/delete | ✅ | ❌ (read-only)
Discord live summaries | ✅ | ❌
Google Calendar actions | ✅ | ❌
ElevenLabs TTS | ✅ (if key supplied) | ✅ (works independently)

---

## 6. Handling CORS Errors (Notion & Other APIs)

1. **Never** call `https://api.notion.com` from the browser.  
2. Use the local proxy:  
   `http://localhost:3001/notion/<endpoint>`  
   The Express server adds the correct `Access-Control-Allow-Origin` headers.
3. If you still see CORS in the browser dev tools:
   * Verify the proxy is **running** (`node server.js` prints `Proxy listening …`).
   * Confirm React env variable: `VITE_NOTION_PROXY_URL=http://localhost:3001/notion`.
   * Restart the front-end dev server after changing env files.

---

## 7. Debugging the Notion Integration

Checklist:

1. Proxy running?  
   `curl http://localhost:3001/health` → should return `OK`.
2. Valid Notion secret?  
   `curl http://localhost:3001/notion/v1/users/me -H "x-notion-token:$VITE_NOTION_API_KEY"`.
3. Using correct database/page IDs?  
   They must be UUID‐style; remove “https://www.notion.so/…”.
4. API version mismatch?  
   Proxy forwards `Notion-Version: 2022-06-28` by default. Update in `server.js` if Notion upgrades.
5. Still failing?  
   * Run `DEBUG=proxy* node server.js` to view detailed forwarding logs.  
   * Enable verbose logging in `src/services/notionService.ts` by setting `DEBUG_NOTION=true` in `.env`.

---

## Need More Help?

* **Logs** – Open your browser console **and** the terminal running the proxy.  
* **Discord** – Post your stack trace in the #museroom-dev channel.  
* **Docs** – See `README.md` and `NOTION_MCP_SETUP.md` for environment setup.

Happy debugging!
