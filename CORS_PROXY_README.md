# CORS Proxy for Notion API  
*A practical guide for MuseRoom Dashboard developers*

---

## 1. Why a CORS proxy?

1. **Same-Origin Policy**  
   Browsers block JavaScript running on `http://localhost:3000` from reading responses that originate from `https://api.notion.com` unless the server explicitly allows it with the `Access-Control-Allow-Origin` header.

2. **Notion API limitation**  
   The public Notion API **does not** send CORS headers, so every direct `fetch("https://api.notion.com/v1/...")` from the browser fails with:

   ```
   Access to fetch at 'https://api.notion.com/v1/pages'
   from origin 'http://localhost:3000' has been blocked by CORS policy
   ```

3. **Solution**  
   Run a tiny server on your machine that:
   • Receives the browser request  
   • Adds the required `Authorization`, `Notion-Version`, and CORS headers  
   • Forwards the request to Notion  
   • Streams the response back to the browser

   This is the **CORS proxy** shipped in `server.js`.

---

## 2. How the proxy works

```text
+-------------+              +----------------+              +------------------+
| React App   |  fetch /api  |  Local Proxy   |  fetch       |  Notion REST API |
| localhost   +----------->  | localhost:3005 +----------->  | api.notion.com   |
| :3000/3001  |              | (Express)      |              |                  |
+-------------+              +----------------+              +------------------+
         ^                                                                 |
         |                CORS headers injected (<-- allow *)              |
         +-----------------------------------------------------------------+
```

1. **Incoming** – Browser calls `http://localhost:3005/api/notion/v1/pages/...`
2. **Inject** – Proxy adds:
   ```http
   Authorization: Bearer <NOTION_TOKEN>
   Notion-Version: 2022-06-28
   Access-Control-Allow-Origin: *
   ```
3. **Forward** – Makes the real request to `https://api.notion.com/v1/...`
4. **Return** – Streams JSON back to the browser, CORS satisfied.

---

## 3. Quick setup

1. **Install dependencies**

   ```
   npm install express http-proxy-middleware dotenv
   ```

2. **Create `.env`**

   ```
   NOTION_TOKEN=secret_abc123               # internal integration token
   PROXY_PORT=3005                          # optional, default 3005
   ALLOWED_ORIGIN=http://localhost:3000     # dev server url
   ```

3. **Start the proxy**

   ```
   node server.js
   ```

   Console output:

   ```
   ▸ Notion CORS proxy listening on http://localhost:3005
   ```

4. **Verify**

   ```
   curl -H "Origin: http://localhost:3000" \
        http://localhost:3005/api/notion/v1/search
   ```

   Should return JSON search results.

---

## 4. Using from the frontend

In `src/services/notionService.ts` the base URL is set to:

```ts
const BASE_URL = import.meta.env.VITE_NOTION_PROXY_URL || "http://localhost:3005/api/notion";
```

All Notion calls (`pages`, `databases`, `search`, …) are automatically routed through the proxy.

---

## 5. Security considerations

| Risk | Mitigation |
|-----|------------|
| **Token leakage** | Token lives only in `.env` on the server side. The browser never sees it. |
| **Open relay** | Proxy checks `ALLOWED_ORIGIN`. Requests from other origins are rejected. |
| **Rate limits** | Still subject to Notion’s per-token rate limits. Use one token per workspace. |

> **Production** – deploy the proxy behind your own firewall/VPN or serverless function (Cloudflare Workers, Vercel Edge, etc.) and lock down allowed origins to your prod domain.

---

## 6. Advanced configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `NOTION_TOKEN` | – | Internal integration token. Required. |
| `PROXY_PORT` | `3005` | Listening port. |
| `ALLOWED_ORIGIN` | `*` | Comma-separated list of origins allowed to hit the proxy. |
| `LOG_LEVEL` | `info` | `silent`, `info`, or `debug`. |

Example `.env` for staging:

```
NOTION_TOKEN=secret_live_token
PROXY_PORT=8080
ALLOWED_ORIGIN=https://dashboard.museroom.app
LOG_LEVEL=debug
```

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `CORS error: blocked by policy` | Check that the proxy is running and `VITE_NOTION_PROXY_URL` matches the port. |
| `401 unauthorized` from Notion | Ensure `NOTION_TOKEN` is valid and has workspace access. |
| Proxy logs `Origin not allowed` | Add your dev/prod URL to `ALLOWED_ORIGIN`. |
| Port collision | Change `PROXY_PORT` in `.env` and `VITE_NOTION_PROXY_URL`. |

---

## 8. FAQ

**Q: Can I skip the proxy and call Notion directly?**  
A: Not in the browser – CORS will block you. You *can* make direct calls from a serverless function if you don’t need real-time UI.

**Q: Is this the same as Notion MCP?**  
A: No. The MCP server provides **tool-calling** for LLMs. The CORS proxy is a very small layer only solving browser CORS.

**Q: Does this add latency?**  
A: Negligible on localhost (~1-2 ms). In production place the proxy in the same region as your frontend for minimal overhead.

---

Happy building! If you run into issues open a ticket or ping #dev-help in Discord.
