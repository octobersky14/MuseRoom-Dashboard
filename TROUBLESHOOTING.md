# MuseRoom Dashboard — Troubleshooting Guide

This document collects the most common problems encountered while running **MuseRoom** and offers step-by-step fixes.

---

## 1. Notion MCP Integration

### 1.1  Connection-Mode Decision Tree  

| Mode | Status Badges | Typical Error | What it Means | Fix |
|------|---------------|---------------|---------------|----|
| **direct** | `Connected` ⟶ `Authenticated` | `Connection Status: ERROR` | Browser cannot open SSE to `mcp.notion.com` | a) Corporate proxy / firewall b) Beta access expired |
| **proxy** | `Using Fallback Service` | `CORS 403` or `404 Proxy route` | Local Express proxy unreachable or blocked | a) Proxy server not running b) Wrong `VITE_NOTION_PROXY_URL` |
| **offline** | `Offline Mode Active` | n/a (mock data) | App has switched to mock responses | a) Intentional `offline` mode b) AI / Notion keys invalid |

### 1.2  Quick Diagnostics  

1. **Check env vars**  
   `cat .env | grep VITE_NOTION_MCP_MODE` → _direct / proxy / offline_  
2. **Direct mode**  
   ```bash
   curl -I https://mcp.notion.com/sse
   ```  
   • `HTTP/2 200` → endpoint up  
   • `curl: (6) Could not resolve host` → DNS/firewall block  
3. **Proxy mode**  
   ```bash
   curl http://localhost:3005/api/notion/v1/search
   ```  
   Should return JSON list (or `{"object":"error"}` if token bad).  
4. **Offline mode**  
   Search results always begin with “Mock Page …” → confirm mock path.

### 1.3  Common Error Messages & Fixes  

| Error Message | Likely Cause | Resolution |
|---------------|-------------|------------|
| `OAuth window opens but stays blank` | Third-party cookies blocked | Allow cookies for notion.com OR switch to proxy mode |
| `Auth Status: ERROR` | Beta access revoked | Re-apply for MCP beta or use proxy mode |
| `403 invalid_cors_request` in dev-tools | `ALLOWED_ORIGINS` mismatch | Edit `.env` in proxy: `ALLOWED_ORIGINS=http://localhost:3000` |
| `Failed to connect to Notion MCP` (console) | SSE blocked | Use VPN or proxy mode |

---

## 2. AI API Key & Offline Behaviour

| Symptom | Root Cause | Solution |
|---------|------------|----------|
| `Gemini API key is required` banner | `VITE_GEMINI_API_KEY` empty | Add a valid key, restart Vite |
| Assistant always replies with “(offline mock)” messages | Key expired / quota exceeded | • Obtain new key • Or remain in offline mode for demo |
| Banner: **Operating in offline mode – some AI features may be limited** | Automatic fail-over triggered | Check network, regenerate key, restart app, toggle *Disable Offline* in UI |

**Verify key validity**

```bash
curl -H "X-Goog-Api-Key: $VITE_GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1beta/models
```

`401 PERMISSION_DENIED` → bad/expired key.

---

## 3. Voice Recognition & Text-to-Speech

### 3.1  Microphone / STT

| Issue | Checkpoints | Fix |
|-------|-------------|-----|
| “Not picking up my voice” | Browser permissions | Click 🔒 icon → **Allow Microphone** |
| Speech stops after ~1 min | Mobile Safari energy saver | Use desktop Chrome/Edge |

### 3.2  ElevenLabs TTS

| Error Toast | Cause | Steps |
|-------------|-------|-------|
| **ElevenLabs API Key Required** | Key missing | Add `VITE_ELEVENLABS_API_KEY` |
| **Failed to play audio** | Network block / wrong voice ID | • Test with `Test Voice` button • Try default voice `EXAVITQu4vr4xnSDxMaL` |

Fallback: MuseRoom auto-switches to the browser’s Web-Speech TTS when ElevenLabs fails.

---

## 4. Network & CORS Problems

### 4.1  Proxy server refuses connection

```
GET http://localhost:3005/api/notion/v1/search net::ERR_CONNECTION_REFUSED
```
*Proxy not running.*  
`node server.js` then reload page.

### 4.2  CORS 403 “invalid_cors_request”

*Origin header not on allow-list.*  
Edit `.env` in **server.js** project:

```
ALLOWED_ORIGINS=http://localhost:3000
```
Restart proxy.

### 4.3  Mixed-Content HTTPS errors

Running dashboard on `https://localhost` but proxy on `http://` triggers mixed-content block.  
Solution: run both on `http` during development **or** proxy through `https://127.0.0.1.nip.io:3005`.

---

## 5. Browser Compatibility

| Feature | Chrome / Edge | Firefox | Safari |
|---------|---------------|---------|--------|
| Web Speech Recognition | ✅ | ⚠ experimental | ❌ (use ElevenLabs only) |
| Server-Sent Events w/ cookies | ✅ | ✅ | ⚠ requires third-party cookies |
| Web-kit AudioContext (TTS) | ✅ | ✅ | ✅ |
| Notion OAuth popup | ✅ | ✅ | ❌ blocks third-party cookies by default |

**Recommendations**

1. Use latest **Chrome** or **Edge** for full voice + MCP experience.  
2. On Safari enable: Preferences → Privacy → *Disable “Prevent cross-site tracking”*.  
3. Mobile browsers: voice recording limited to foreground tabs.

---

## 6. Quick Reference Commands

```bash
# Start dashboard in proxy mode
./run-mcp-services.sh --mode proxy

# Check proxy health
curl http://localhost:3005/health

# Validate Notion token (REST)
curl -H "Authorization: Bearer $VITE_NOTION_API_KEY" \
     -H "Notion-Version: 2022-06-28" \
     https://api.notion.com/v1/users/me
```

---

### Still Stuck?

1. Open dev-tools Console → copy any red stack traces.  
2. Run `npm run lint` to catch compile issues.  
3. Create a GitHub issue with:  
   * Browser & version  
   * Dashboard mode (direct/proxy/offline)  
   * Exact error messages  
   * `TROUBLESHOOTING.md` steps already attempted  
   * Network log (HAR) if possible  

The community and maintainers will jump in to help. Good luck!
