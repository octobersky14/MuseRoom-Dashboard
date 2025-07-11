// Backend API Example for Notion Integration
// This file shows how to set up proper Notion OAuth and workspace access
// Deploy this to Vercel, Netlify Functions, or any serverless platform

const { Client } = require("@notionhq/client");

// Environment variables needed for production:
// NOTION_CLIENT_ID - Your Notion OAuth app client ID
// NOTION_CLIENT_SECRET - Your Notion OAuth app client secret
// NOTION_REDIRECT_URI - Your app's redirect URI (e.g., https://yourapp.com/api/notion/callback)
// NOTION_WORKSPACE_ID - Your company's shared workspace ID
// JWT_SECRET - Secret for signing user tokens
// DATABASE_URL - Database connection string for storing user sessions

// Example database schema (use your preferred database):
// CREATE TABLE notion_users (
//   id VARCHAR(255) PRIMARY KEY,
//   email VARCHAR(255) UNIQUE NOT NULL,
//   name VARCHAR(255) NOT NULL,
//   access_token VARCHAR(255) NOT NULL,
//   workspace_id VARCHAR(255) NOT NULL,
//   access_level ENUM('admin', 'editor', 'viewer') DEFAULT 'viewer',
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// );

// Notion OAuth Setup
const NOTION_CONFIG = {
  clientId: process.env.NOTION_CLIENT_ID,
  clientSecret: process.env.NOTION_CLIENT_SECRET,
  redirectUri: process.env.NOTION_REDIRECT_URI,
  workspaceId: process.env.NOTION_WORKSPACE_ID,
};

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_INTEGRATION_TOKEN, // For server-side operations
});

// 1. OAUTH INITIATION ENDPOINT
// GET /api/notion/oauth
exports.initiateOAuth = async (req, res) => {
  try {
    const { redirect } = req.query;

    // Build OAuth URL
    const oauthUrl = new URL("https://api.notion.com/v1/oauth/authorize");
    oauthUrl.searchParams.append("client_id", NOTION_CONFIG.clientId);
    oauthUrl.searchParams.append("response_type", "code");
    oauthUrl.searchParams.append("redirect_uri", NOTION_CONFIG.redirectUri);
    oauthUrl.searchParams.append("state", redirect || "/");

    // Add workspace scope
    oauthUrl.searchParams.append("scope", "read,write");

    res.json({
      success: true,
      oauthUrl: oauthUrl.toString(),
      message: "Redirect user to this URL to begin OAuth flow",
    });
  } catch (error) {
    console.error("OAuth initiation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initiate OAuth flow",
    });
  }
};

// 2. OAUTH CALLBACK ENDPOINT
// GET /api/notion/callback
exports.handleOAuthCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: "Missing authorization code",
      });
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(
          `${NOTION_CONFIG.clientId}:${NOTION_CONFIG.clientSecret}`
        ).toString("base64")}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: NOTION_CONFIG.redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error("Failed to get access token");
    }

    // Get user info from Notion
    const userNotionClient = new Client({
      auth: tokenData.access_token,
    });

    const userInfo = await userNotionClient.users.me();

    // Store user in database
    const userData = {
      id: userInfo.id,
      email: userInfo.person?.email || `${userInfo.id}@notion.user`,
      name: userInfo.name || "Notion User",
      access_token: tokenData.access_token,
      workspace_id: NOTION_CONFIG.workspaceId,
      access_level: "editor", // Default access level
    };

    // Save to database (replace with your database logic)
    await saveUserToDatabase(userData);

    // Generate JWT token for your app
    const jwt = require("jsonwebtoken");
    const appToken = jwt.sign(
      {
        userId: userData.id,
        email: userData.email,
        workspaceId: userData.workspace_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Redirect back to your app with token
    const redirectUrl = new URL(state || "/", req.headers.origin);
    redirectUrl.searchParams.append("token", appToken);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to complete OAuth flow",
    });
  }
};

// 3. GET USER INFO ENDPOINT
// GET /api/notion/user
exports.getUserInfo = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "No token provided",
      });
    }

    // Verify JWT token
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const userData = await getUserFromDatabase(decoded.userId);

    if (!userData) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        accessLevel: userData.access_level,
        workspaceId: userData.workspace_id,
      },
    });
  } catch (error) {
    console.error("Get user info error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get user info",
    });
  }
};

// 4. GET WORKSPACE PAGES ENDPOINT
// GET /api/notion/workspace/:workspaceId/pages
exports.getWorkspacePages = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const token = req.headers.authorization?.replace("Bearer ", "");

    // Verify user has access to this workspace
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userData = await getUserFromDatabase(decoded.userId);

    if (!userData || userData.workspace_id !== workspaceId) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this workspace",
      });
    }

    // Use user's access token to get pages
    const userNotionClient = new Client({
      auth: userData.access_token,
    });

    // Search for pages in the workspace
    const searchResponse = await userNotionClient.search({
      filter: {
        property: "object",
        value: "page",
      },
      sort: {
        direction: "descending",
        timestamp: "last_edited_time",
      },
      page_size: 20,
    });

    // Format pages for frontend
    const pages = searchResponse.results.map((page) => ({
      id: page.id,
      title: getPageTitle(page),
      icon: page.icon?.emoji || page.icon?.external?.url || "📄",
      type: page.parent?.type || "page",
      url: page.url,
      lastEdited: page.last_edited_time,
      createdBy: page.created_by?.id,
    }));

    res.json({
      success: true,
      pages: pages,
      total: searchResponse.results.length,
    });
  } catch (error) {
    console.error("Get workspace pages error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get workspace pages",
    });
  }
};

// 5. CREATE NEW PAGE ENDPOINT
// POST /api/notion/workspace/:workspaceId/pages
exports.createPage = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { title, content, parentId } = req.body;
    const token = req.headers.authorization?.replace("Bearer ", "");

    // Verify user access
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userData = await getUserFromDatabase(decoded.userId);

    if (!userData || userData.workspace_id !== workspaceId) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this workspace",
      });
    }

    const userNotionClient = new Client({
      auth: userData.access_token,
    });

    // Create new page
    const newPage = await userNotionClient.pages.create({
      parent: parentId ? { page_id: parentId } : { workspace: true },
      properties: {
        title: {
          title: [
            {
              text: {
                content: title || "New Page",
              },
            },
          ],
        },
      },
      children: content
        ? [
            {
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [
                  {
                    type: "text",
                    text: {
                      content: content,
                    },
                  },
                ],
              },
            },
          ]
        : [],
    });

    res.json({
      success: true,
      page: {
        id: newPage.id,
        title: getPageTitle(newPage),
        url: newPage.url,
      },
    });
  } catch (error) {
    console.error("Create page error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create page",
    });
  }
};

// 6. DISCONNECT USER ENDPOINT
// DELETE /api/notion/user
exports.disconnectUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Remove user from database
    await removeUserFromDatabase(decoded.userId);

    res.json({
      success: true,
      message: "User disconnected successfully",
    });
  } catch (error) {
    console.error("Disconnect user error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to disconnect user",
    });
  }
};

// HELPER FUNCTIONS
function getPageTitle(page) {
  if (page.properties?.title?.title?.[0]?.text?.content) {
    return page.properties.title.title[0].text.content;
  }
  if (page.properties?.Name?.title?.[0]?.text?.content) {
    return page.properties.Name.title[0].text.content;
  }
  return "Untitled";
}

// Database helper functions (implement with your preferred database)
async function saveUserToDatabase(userData) {
  // Example with PostgreSQL/MySQL
  // const db = require('./database');
  // await db.query(`
  //   INSERT INTO notion_users (id, email, name, access_token, workspace_id, access_level)
  //   VALUES (?, ?, ?, ?, ?, ?)
  //   ON DUPLICATE KEY UPDATE
  //   access_token = VALUES(access_token),
  //   updated_at = CURRENT_TIMESTAMP
  // `, [userData.id, userData.email, userData.name, userData.access_token, userData.workspace_id, userData.access_level]);

  console.log("Saving user to database:", userData.id);
}

async function getUserFromDatabase(userId) {
  // Example with PostgreSQL/MySQL
  // const db = require('./database');
  // const result = await db.query('SELECT * FROM notion_users WHERE id = ?', [userId]);
  // return result[0];

  console.log("Getting user from database:", userId);
  return null; // Replace with actual database query
}

async function removeUserFromDatabase(userId) {
  // Example with PostgreSQL/MySQL
  // const db = require('./database');
  // await db.query('DELETE FROM notion_users WHERE id = ?', [userId]);

  console.log("Removing user from database:", userId);
}

// DEPLOYMENT CONFIGURATION
module.exports = {
  initiateOAuth: exports.initiateOAuth,
  handleOAuthCallback: exports.handleOAuthCallback,
  getUserInfo: exports.getUserInfo,
  getWorkspacePages: exports.getWorkspacePages,
  createPage: exports.createPage,
  disconnectUser: exports.disconnectUser,
};

// For Vercel deployment, create separate files in /api/ directory:
// /api/notion/oauth.js
// /api/notion/callback.js
// /api/notion/user.js
// /api/notion/workspace/[workspaceId]/pages.js

// For Netlify deployment, create functions in /netlify/functions/ directory:
// /netlify/functions/notion-oauth.js
// /netlify/functions/notion-callback.js
// /netlify/functions/notion-user.js
// /netlify/functions/notion-pages.js
