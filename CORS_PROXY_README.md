# Fixing CORS with a Local Notion API Proxy  
_MuseRoom Dashboard — developer guide_

---

## 1. What is CORS and why is it blocking me?

• **CORS** (Cross-Origin Resource Sharing) is a browser security rule that stops JavaScript on <http://localhost:3004> from talking directly to a server that lives on a **different origin** (for example `https://api.notion.com`).  
• The Notion REST API does **not** add the special `Access-Control-Allow-Origin` header that would permit your browser request, so the browser cancels the call and prints the familiar error:

```
Access to fetch at 'https://api.notion.com/v1/search' from origin 'http://localhost:3004'
has been blocked by CORS policy
```

> Good news: servers can still talk to each other freely.  
> We just need a tiny server running on **our origin** that forwards (or “proxies”) the request to Notion and then gives the result back to the browser.

---

## 2. How the proxy works (30-second tour)

1. Your React app sends a request to `http://localhost:3005/api/notion/...` (same origin → no CORS).
2. The **local proxy server** receives the request, attaches your Notion API key and the required `Notion-Version` header.
3. The proxy forwards everything to `https://api.notion.com/v1/...`.
4. When Notion replies, the proxy immediately passes the JSON back to the browser — with permissive CORS headers.
5. The browser is happy, you get data, no security rules broken.

---

## 3. One-time setup

### 3.1 Install dependencies

```bash
npm install express cors axios dotenv
```

These packages are already listed in `package.json`; the command above is only needed if they are not yet in `node_modules`.

### 3.2 Project files

```
/
├── server.js                 # Runs the proxy during local development
└── src/api/notionProxy.js    # Pure proxy handler (also deployable serverlessly)
```

Copy the provided files (or generate them with the scaffold) into your repo root exactly as shown above.

### 3.3 Environment variables

Create a `.env` in the project root:

```
# Notion integration
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Proxy settings
PROXY_PORT=3005
FRONTEND_URL=http://localhost:3004
VITE_NOTION_PROXY_URL=http://localhost:3005/api/notion
```

*`NOTION_API_KEY` is your **internal integration token** from Notion → keep it private.*

---

## 4. Starting everything in development

Open **two** terminals or run concurrently:

```bash
# Terminal ① – start the proxy
npm run proxy         # or: node server.js

# Terminal ② – start the React/Vite dev server
npm run dev
```

You should see in terminal ①:

```
Notion API proxy server running on http://localhost:3005
```

---

## 5. Using the proxy in the React application

### 5.1 Service configuration

`src/services/notionService.ts` now points to the proxy:

```ts
this.baseUrl = import.meta.env.VITE_NOTION_PROXY_URL || 'http://localhost:3005/api/notion';
```

Every request includes the custom header:

```ts
headers: {
  'x-notion-api-key': process.env.NOTION_API_KEY,
  'Content-Type': 'application/json',
}
```

Nothing else changes — you can still call `search`, `createPage`, etc.

### 5.2 Testing

```ts
const pages = await notionService.getAllPages();
console.log(pages);
```

Open the browser dev tools → **Network**  
You should see requests hitting `localhost:3005/api/notion/search`, all green.

---

## 6. Deploying the proxy

You have three options:

| Option | When to choose | Notes |
|--------|----------------|-------|
| **Same Node server** | You already run a custom backend | Mount the `notionProxy` handler under `/api/notion/*`. |
| **Serverless function** | Deploying to Vercel / Netlify | Copy `src/api/notionProxy.js` into `api/notion.js`. |
| **Standalone micro-service** | Complex infra / k8s | Expose on its own domain, set `VITE_NOTION_PROXY_URL` accordingly. |

Remember to set `FRONTEND_URL` to your production domain and use a **production** Notion key.

---

## 7. General tips for CORS pain in other APIs

1. **Check docs first** – many public APIs expose a CORS-enabled endpoint (e.g. `https://api.example.com/public`).
2. **Use a proxy** – pattern above works for any API that allows server-to-server calls.
3. **Configure the API** – if you own the API backend, simply add  
   `Access-Control-Allow-Origin: *` (or a specific origin list) to responses.
4. **Avoid client secrets in the browser** – proxy keeps tokens on the server, never ship them to the client.

---

## 8. Troubleshooting checklist

| Symptom | Fix |
|---------|-----|
| `CORS` error persists | Verify the React app **exactly** matches `FRONTEND_URL`. |
| `401 unauthorized` from Notion | Wrong `NOTION_API_KEY` or integration lacks workspace access. |
| Proxy returns `500` | Check terminal ① logs — error message is forwarded. |
| React still calls `https://api.notion.com` directly | Make sure `VITE_NOTION_PROXY_URL` is loaded (restart `npm run dev`). |

---

### That’s it!  
You can now call the Notion API from your React app without any CORS headaches while keeping your secret token secure. Happy building! 🚀
