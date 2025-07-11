# Production Deployment Guide

## Overview

This guide will help you deploy the MuseRoom Dashboard with integrated Notion workspace access for your entire company. The system allows team members to connect their individual Notion accounts to access a shared company workspace.

## Architecture

- **Frontend**: React dashboard with voice/text AI assistant
- **Backend**: Serverless API for Notion OAuth and workspace access
- **Database**: User session storage and workspace permissions
- **Deployment**: Vercel/Netlify for frontend, serverless functions for backend

## Prerequisites

### 1. Notion Integration Setup

1. Go to [Notion Developers](https://developers.notion.com/)
2. Create a new integration for your company workspace
3. Note down these values:
   - Integration Token (for server-side API calls)
   - OAuth Client ID
   - OAuth Client Secret
   - Your Company Workspace ID

### 2. Database Setup

Choose one of these options:

- **PostgreSQL**: Neon, Supabase, or Railway
- **MySQL**: PlanetScale or Railway
- **MongoDB**: MongoDB Atlas
- **SQLite**: For development only

### 3. Environment Variables

Create these environment variables in your deployment platform:

```bash
# Notion Integration
NOTION_CLIENT_ID=your_notion_oauth_client_id
NOTION_CLIENT_SECRET=your_notion_oauth_client_secret
NOTION_INTEGRATION_TOKEN=your_notion_integration_token
NOTION_WORKSPACE_ID=your_company_workspace_id
NOTION_REDIRECT_URI=https://yourapp.com/api/notion/callback

# JWT & Security
JWT_SECRET=your_random_jwt_secret_key
NEXTAUTH_SECRET=your_nextauth_secret

# Database
DATABASE_URL=your_database_connection_string

# ElevenLabs (Optional)
VITE_ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Discord Integration (Optional)
DISCORD_WEBHOOK_URL=your_discord_webhook_url
```

## Deployment Options

### Option 1: Vercel (Recommended)

#### Steps:

1. **Fork/Clone** the repository to your GitHub account
2. **Connect to Vercel**:
   ```bash
   npm install -g vercel
   vercel login
   vercel
   ```
3. **Set Environment Variables** in Vercel dashboard
4. **Database Setup**:
   ```sql
   -- Create the user table
   CREATE TABLE notion_users (
     id VARCHAR(255) PRIMARY KEY,
     email VARCHAR(255) UNIQUE NOT NULL,
     name VARCHAR(255) NOT NULL,
     access_token VARCHAR(255) NOT NULL,
     workspace_id VARCHAR(255) NOT NULL,
     access_level ENUM('admin', 'editor', 'viewer') DEFAULT 'viewer',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   );
   ```
5. **Create API endpoints** in `/api/` directory:
   - `/api/notion/oauth.js`
   - `/api/notion/callback.js`
   - `/api/notion/user.js`
   - `/api/notion/workspace/[workspaceId]/pages.js`

#### Vercel Configuration (`vercel.json`):

```json
{
  "functions": {
    "api/notion/*.js": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/notion/:path*",
      "destination": "/api/notion/:path*"
    }
  ]
}
```

### Option 2: Netlify

#### Steps:

1. **Connect Repository** to Netlify
2. **Build Settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. **Environment Variables** in Netlify dashboard
4. **Netlify Functions** in `/netlify/functions/` directory:
   - `notion-oauth.js`
   - `notion-callback.js`
   - `notion-user.js`
   - `notion-pages.js`

#### Netlify Configuration (`netlify.toml`):

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/api/notion/*"
  to = "/.netlify/functions/:splat"
  status = 200

[functions]
  directory = "netlify/functions"
```

### Option 3: Self-Hosted (Docker)

#### Dockerfile:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### docker-compose.yml:

```yaml
version: "3.8"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - NOTION_CLIENT_ID=${NOTION_CLIENT_ID}
      - NOTION_CLIENT_SECRET=${NOTION_CLIENT_SECRET}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - db

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=museroom
      - POSTGRES_USER=admin
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

## Frontend Integration

### Update NotionWorkspace Component

Replace the mock authentication with real API calls:

```typescript
// src/components/NotionWorkspace.tsx
const connectToNotion = async () => {
  setIsConnecting(true);

  try {
    // Get OAuth URL from your backend
    const response = await fetch("/api/notion/oauth", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const { oauthUrl } = await response.json();

    // Redirect to Notion OAuth
    window.location.href = oauthUrl;
  } catch (error) {
    console.error("OAuth error:", error);
    setIsConnecting(false);
  }
};

const checkNotionConnection = async () => {
  try {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    const response = await fetch("/api/notion/user", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const { user } = await response.json();
      setNotionUser(user);
    }
  } catch (error) {
    console.error("Connection check error:", error);
  }
};
```

### Handle OAuth Callback

Add a callback handler to process the OAuth response:

```typescript
// src/components/OAuthCallback.tsx
import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");

    if (token) {
      localStorage.setItem("auth_token", token);
      navigate("/");
    } else {
      navigate("/?error=oauth_failed");
    }
  }, [searchParams, navigate]);

  return <div>Connecting to Notion...</div>;
}
```

## Security Considerations

### 1. Environment Variables

- Never commit secrets to version control
- Use different keys for development and production
- Rotate secrets regularly

### 2. Database Security

- Use connection pooling
- Enable SSL/TLS for database connections
- Regular backups and monitoring

### 3. API Security

- Implement rate limiting
- Validate all inputs
- Use HTTPS everywhere
- Implement proper CORS policies

### 4. User Data Protection

- Encrypt sensitive data at rest
- Implement proper session management
- Follow GDPR/privacy regulations
- Regular security audits

## Monitoring & Maintenance

### 1. Error Tracking

- Sentry for error monitoring
- LogRocket for user session recording
- Custom analytics for usage patterns

### 2. Performance Monitoring

- Vercel Analytics or Netlify Analytics
- Core Web Vitals monitoring
- API response time tracking

### 3. Database Monitoring

- Query performance optimization
- Connection pool monitoring
- Backup verification

## Team Onboarding

### 1. Initial Setup

1. Admin sets up the Notion integration
2. Team members receive invitation link
3. Each member connects their Notion account
4. Access levels are assigned (admin/editor/viewer)

### 2. Daily Usage

- Team members access dashboard at your domain
- Voice/text AI assistant helps with navigation
- Shared workspace content is accessible to all
- Real-time collaboration through Notion

### 3. Management

- Admin can view connected users
- Access levels can be modified
- Usage analytics available
- Workspace content is centrally managed

## Troubleshooting

### Common Issues:

1. **OAuth Fails**: Check redirect URI configuration
2. **Database Connection**: Verify connection string and permissions
3. **API Errors**: Check environment variables and function logs
4. **Notion API Limits**: Implement proper rate limiting and caching

### Support:

- Check deployment platform logs
- Monitor API response times
- Review Notion API documentation
- Test with different user roles

## Cost Estimation

### Vercel Pro:

- $20/month for team features
- $0.40 per GB-second for functions
- Free tier: 100GB-seconds/month

### Netlify Pro:

- $19/month for team features
- 125,000 function invocations/month
- Additional usage charged

### Database:

- Neon: $0-$69/month
- Supabase: $0-$25/month
- PlanetScale: $0-$39/month

### Total Monthly Cost:

- Small team (5-10 users): $20-50/month
- Medium team (10-50 users): $50-150/month
- Large team (50+ users): $150-500/month

## Next Steps

1. **Choose your deployment platform**
2. **Set up Notion integration**
3. **Configure environment variables**
4. **Deploy and test**
5. **Invite team members**
6. **Monitor and optimize**

Your dashboard will be live at your chosen domain (e.g., `https://dashboard.yourcompany.com`) and ready for your team to use! 🚀
