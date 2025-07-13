// src/api/notionProxy.js
import axios from 'axios';

// Base URL for Notion API
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

/**
 * Proxy server for Notion API requests to avoid CORS issues
 * This can be deployed as a serverless function on platforms like Vercel or Netlify
 * 
 * @param {Object} req - The incoming request object
 * @param {Object} res - The response object
 */
export default async function handler(req, res) {
  // Set CORS headers to allow requests from your frontend
  res.setHeader('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'https://your-production-domain.com' 
    : 'http://localhost:3004');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-notion-api-key');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Get the Notion API key from environment variables
    const notionApiKey = process.env.NOTION_API_KEY || req.headers['x-notion-api-key'];
    
    if (!notionApiKey) {
      return res.status(400).json({ error: 'Notion API key is required' });
    }

    // Extract the path from the request URL
    // Example: If request is to /api/notion/search, endpoint will be 'search'
    const endpoint = req.url.replace(/^\/api\/notion\//, '');
    
    // Construct the full Notion API URL
    const notionUrl = `${NOTION_API_BASE_URL}/${endpoint}`;

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
    
    // Return appropriate error response
    const status = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Internal Server Error';
    
    return res.status(status).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
