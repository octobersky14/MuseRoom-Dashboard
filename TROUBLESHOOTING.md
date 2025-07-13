# Troubleshooting Guide

This document lists the most common problems you may encounter while running or deploying the MuseRoom Dashboard and how to resolve them.

---

## 1. CORS (Cross-Origin Resource Sharing)

| Symptom | Typical Console/Error Message | Root Cause | Fix |
|---------|------------------------------|-----------|-----|
| Browser shows `… has been blocked by CORS policy` and the URL is **https://api.notion.com** | `No 'Access-Control-Allow-Origin' header` | Front-end tried to call Notion directly. Proxy not used or mis-configured. | 1. Make sure **proxy server** is running (`node server.js` or `npm run proxy`).<br/>2. `src/services/notionService.ts` must point to `http://localhost:3005/api/notion` (or your deployed proxy).<br/>3. Verify `VITE_NOTION_PROXY_URL` in `.env` and restart Vite dev server.<br/>4. Confirm the browser request URL now starts with `localhost:3005/api/notion`. |
| CORS error but URL already points to proxy | `origin http://localhost:3000 not allowed` | Proxy allows only whitelisted origins. | 1. Add the origin to `ALLOWED_ORIGINS` in `.env` (comma-separated).<br/>2. Restart proxy server. |
| Pre-flight (`OPTIONS`) request returns **404** | — | Reverse-proxy or hosting platform strips `OPTIONS` method. | Ensure your hosting setup forwards all HTTP verbs to the proxy function / server. |

### Quick Checks
```bash
# Is proxy alive?
curl http://localhost:3005/health   # should return {"status":"ok"}
# Does proxy forward?
curl -X POST http://localhost:3005/api/notion/search \
     -H "x-notion-api-key:$NOTION_API_KEY" \
     -d '{"query":""}'
```

---

## 2. API Connection Issues

### 2.1 Notion API
| Symptom | Fix |
|---------|-----|
| `401 Unauthorized` from proxy | Wrong `NOTION_API_KEY`, or integration not added to workspace. Regenerate token and update `.env`. |
| `object_not_found` | Provided page/database ID does not exist in the workspace connected to the integration. |

### 2.2 Gemini (Google Generative AI)
| Symptom | Fix |
|---------|-----|
| `403 PERMISSION_DENIED` | Free tier exhausted, model name typo, or key restricted by IP/HTTP referrer. Verify `GEMINI_API_KEY` and model name (`gemini-1.5-flash`). |
| `Fetch failed` in browser | NEVER call Gemini directly from browser unless using a public key; instead, route through backend. |

### 2.3 Google Calendar
| Symptom | Fix |
|---------|-----|
| `invalid_grant` during OAuth | Wrong redirect URI in Google Cloud Console. Must exactly match the URL served by the app (`/auth/google/callback`). |
| `403 insufficientPermissions` | Calendar scope missing; re-create OAuth consent screen with `https://www.googleapis.com/auth/calendar` scopes. |

### 2.4 Discord
| Symptom | Fix |
|---------|-----|
| Webhook returns `404` | Webhook URL reset or deleted. Generate a new one and update `VITE_DISCORD_WEBHOOK_URL`. |
| Messages post but not visible | Bot lacks permission in channel. Grant **Manage Webhooks** or **Send Messages**. |

---

## 3. Environment & Setup Problems

| Problem | How to Diagnose | Resolution |
|---------|-----------------|------------|
| **Missing env values** | App crashes at startup or shows `process.env.XYZ is undefined`. | Copy `.env.example` ➜ `.env` and fill in **all** placeholders. |
| Wrong ports | Browser requests `localhost:3004` but Vite runs on `3000` (or vice-versa). | Change `vite.config.ts` or `.env` `PORT=` to align, or open correct URL. |
| Proxy port in use | `EADDRINUSE :3005` | Another process using 3005. `lsof -i:3005` ➜ kill or change `PROXY_PORT` then restart. |
| `TypeError: Failed to fetch` everywhere | Network offline, VPN blocking, corporate firewall. | Test with `curl` outside the app, switch network, or whitelist domains. |

---

## 4. Logging & Debugging Tips

1. **Proxy Server**  
   • Requests logged to console (`server.js`).  
   • Add `DEBUG=express:*` before the start command for verbose routing info.

2. **Front-End**  
   • DevTools > Network tab → verify actual request URL & headers.  
   • React DevTools extension helps inspect component props/state.

3. **Reload on env change**  
   • Any change to `.env` requires **restarting** both Vite dev server and proxy for variables to take effect.

---

## 5. FAQ

**Q:** I see `CORS` errors after deploying to production.  
**A:** Deploy the proxy (serverless function or Node micro-service) on the same domain as your front-end (`/api/notion/*`). Update `VITE_NOTION_PROXY_URL` to the production URL and add that origin to `ALLOWED_ORIGINS`.

**Q:** Can I skip the proxy and enable CORS directly on Notion?  
**A:** Notion does not currently allow custom CORS headers. A proxy is required.

**Q:** Requests work in `curl` but not in browser.  
**A:** `curl` doesn’t enforce CORS. If browser fails, your proxy isn’t adding `Access-Control-Allow-Origin` or you’re calling the wrong domain.

---

## 6. Still Stuck?

1. Run the health-checks above.  
2. Search the console output for the **first error** (later errors often cascade).  
3. Create a minimal reproduction (single endpoint call) and test with `curl`.  
4. Open an issue with logs, exact error message, and steps to reproduce.

Happy debugging! 🛠️
