// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PROXY_PORT || 3005;

// CORS configuration
/**
 * Allow requests from the configured production origin **or**
 * the common local dev ports (3000 & 3004).
 * If you need additional origins just add them to the ALLOWED_ORIGINS
 * env-var (comma-separated).
 */
const defaultDevOrigins = ['http://localhost:3000', 'http://localhost:3004'];
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || []
).concat(
  process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL || 'https://your-production-domain.com'
    : defaultDevOrigins
);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow non-browser tools (e.g. curl, Postman) where origin may be undefined
      if (!origin) return cb(null, true);
      return allowedOrigins.includes(origin)
        ? cb(null, true)
        : cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-notion-api-key'],
  })
);

// Parse JSON request body
app.use(express.json());

// Notion API base URL
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

// Notion API proxy endpoint
app.use('/api/notion', async (req, res) => {
  try {
    // Get the Notion API key from environment variables or request header
    const notionApiKey = process.env.NOTION_API_KEY || req.headers['x-notion-api-key'];
    
    if (!notionApiKey) {
      return res.status(400).json({ error: 'Notion API key is required' });
    }

    // Extract the path from the request URL
    const endpoint = req.path.substring(1) || ''; // Remove leading slash
    
    // Construct the full Notion API URL
    const notionUrl = `${NOTION_API_BASE_URL}/${endpoint}`;

    console.log(`Proxying request to Notion API: ${req.method} ${notionUrl}`);

    // Forward the request to Notion API
    const response = await axios({
      method: req.method,
      url: notionUrl,
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      data: req.method !== 'GET' ? req.body : undefined,
      params: req.method === 'GET' ? req.query : undefined,
    });

    // Return the Notion API response to the client
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Notion API Proxy Error:', error);

    /* ---------- Improved Axios-error handling ---------- */
    if (axios.isAxiosError(error) && error.response) {
      // Forward exact status & body from Notion when available
      return res
        .status(error.response.status)
        .json(error.response.data ?? { error: 'Upstream error' });
    }

    // Fallback – unknown/unexpected error
    return res.status(500).json({
      error: 'Internal Server Error',
      details:
        process.env.NODE_ENV === 'development'
          ? error.message ?? 'Unknown error'
          : undefined,
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Notion API proxy server is running' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Notion API proxy server running on http://localhost:${PORT}`);
  console.log(`Use http://localhost:${PORT}/api/notion/* to proxy requests to the Notion API`);
});
