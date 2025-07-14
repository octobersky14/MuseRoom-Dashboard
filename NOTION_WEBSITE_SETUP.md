# Notion Website Integration Setup Guide

## Overview

Your MuseRoom Dashboard now has **full Notion API integration** built directly into the website! This means you can:

- ✅ **View your Notion pages and databases** directly in the dashboard
- ✅ **Create new pages and tasks** from the web interface
- ✅ **Search through your Notion workspace** without leaving the app
- ✅ **Real-time synchronization** with your Notion workspace
- ✅ **Voice commands** to interact with Notion (coming soon)

## Setup Instructions

### 1. Configure Your Environment

Add your Notion API key to your `.env` file:

```bash
# Copy the example file if you haven't already
cp env.example .env
```

Then edit `.env` and add your Notion integration token:

```env
VITE_NOTION_API_KEY=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
```

### 2. Share Pages with Your Integration

**Important:** Your Notion integration can only access pages that have been explicitly shared with it.

1. **Open any Notion page or database** you want to access
2. **Click the "Share" button** (top right)
3. **Click "Invite"** and search for your integration name
4. **Select your integration** and click "Invite"

### 3. Start the Development Server

```bash
npm run dev
```

### 4. Test the Integration

1. **Navigate to the Notion tab** in your dashboard
2. **Click "Test Connection"** - you should see a success message
3. **Click "Refresh Data"** to load your pages and databases
4. **Try creating a new page** or task

## Features Available

### 📄 **Page Management**

- **View all pages** in your workspace
- **Create new pages** with rich content
- **Search pages** by title and content
- **Open pages** directly in Notion

### 🗄️ **Database Management**

- **View all databases** in your workspace
- **Query database entries** (tasks, projects, etc.)
- **Create new database entries**
- **Filter and sort** database content

### ✅ **Task Management**

- **Create tasks** in any database
- **View task status** and due dates
- **Update task properties**
- **Track task progress**

### 🔍 **Search & Discovery**

- **Real-time search** across all content
- **Filter by type** (pages vs databases)
- **Quick navigation** to any content

### 🎤 **Voice Integration** (Coming Soon)

- **Voice commands** to create pages/tasks
- **Speak to search** your workspace
- **Audio summaries** of your content

## API Capabilities

Your integration can:

### **Read Operations**

- List all pages and databases
- Get page content and properties
- Search across workspace
- Query database entries
- Extract text, images, and metadata

### **Write Operations**

- Create new pages with rich content
- Add entries to databases
- Update page properties
- Add blocks (text, headings, lists, etc.)
- Set page icons and covers

### **Content Types Supported**

- **Text blocks** - paragraphs, headings, quotes
- **Lists** - bulleted and numbered
- **Tasks** - to-do items with checkboxes
- **Rich text** - bold, italic, links, mentions
- **Properties** - titles, select, multi-select, dates
- **Media** - images, files, embeds (coming soon)

## Security & Permissions

### **What Your Integration Can Access**

- Only pages and databases **explicitly shared** with it
- Cannot access private pages unless invited
- Cannot access other users' private content
- Cannot modify workspace settings

### **API Key Security**

- Your API key is stored locally in `.env`
- Never shared with external services
- Only used for direct Notion API calls
- Can be revoked anytime from Notion settings

## Troubleshooting

### **Connection Issues**

1. **Check your API key** - ensure it's correct in `.env`
2. **Verify permissions** - make sure pages are shared with your integration
3. **Restart the server** - after changing `.env` variables
4. **Check network** - ensure you can reach api.notion.com

### **No Pages/Databases Showing**

1. **Share content** - invite your integration to specific pages
2. **Refresh data** - click the "Refresh Data" button
3. **Check integration** - verify it's active in Notion settings

### **API Errors**

1. **Rate limiting** - wait a moment and try again
2. **Invalid properties** - check database schema
3. **Permission denied** - share the page with your integration

## Usage Examples

### **Creating a Project Page**

1. Click "New Page" in the Notion tab
2. Enter title: "MuseRoom Dashboard Project"
3. The page will be created with starter content
4. Edit directly in Notion or add more content via API

### **Adding a Task**

1. Click "New Task" in the Notion tab
2. Select your task database
3. Enter task title and description
4. Task will appear in both dashboard and Notion

### **Searching Content**

1. Use the search box in the Notion tab
2. Enter keywords or page titles
3. Click results to open in Notion
4. Use for quick navigation

## Advanced Features

### **Custom Properties**

The integration supports all Notion property types:

- **Text & Numbers** - basic data entry
- **Select & Multi-select** - dropdown options
- **Dates** - due dates, created dates
- **People** - assign to team members
- **Relations** - link between databases
- **Formulas** - calculated fields

### **Rich Content Creation**

You can create pages with:

- **Headings** (H1, H2, H3)
- **Text paragraphs** with formatting
- **Bullet and numbered lists**
- **Checkboxes** for tasks
- **Code blocks** for technical content

### **Webhook Integration** (Coming Soon)

- **Real-time updates** when Notion changes
- **Automatic synchronization**
- **Push notifications** for important updates

## Next Steps

1. **Explore the interface** - try all the features
2. **Create some content** - test page and task creation
3. **Set up your workspace** - organize your databases
4. **Invite team members** - share integration access
5. **Customize properties** - adapt to your workflow

## Support

If you encounter any issues:

1. **Check the browser console** for error messages
2. **Verify your integration** in Notion settings
3. **Test with a simple page** first
4. **Restart the development server**

## What's Next?

Upcoming features:

- 🎤 **Voice commands** for Notion interaction
- 🤖 **AI-powered content** generation
- 📊 **Dashboard analytics** from Notion data
- 🔔 **Real-time notifications** for updates
- 📱 **Mobile optimization** for on-the-go access

---

**Your Notion workspace is now fully integrated with your MuseRoom Dashboard! 🎉**
