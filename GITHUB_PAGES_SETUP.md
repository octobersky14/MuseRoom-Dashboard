# 🚀 GitHub Pages Setup Guide

Super simple deployment for your MuseRoom Dashboard - no complex backend needed!

## ✨ What You Get

- **Free hosting** on GitHub Pages
- **Automatic deployments** when you push to main branch
- **Custom domain support** (optional)
- **HTTPS by default**
- **Simple Notion workspace integration**

## 📋 Quick Setup (5 minutes)

### Step 1: Fork/Clone the Repository

```bash
# If you haven't already, clone your repository
git clone https://github.com/your-username/MuseRoom-Dashboard.git
cd MuseRoom-Dashboard
```

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll down to **Pages** section
4. Set **Source** to "GitHub Actions"

### Step 3: Configure Environment Variables (Optional)

1. In your repository, go to **Settings** > **Secrets and variables** > **Actions**
2. Add these secrets if you want ElevenLabs voice:
   ```
   VITE_ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
   ```

### Step 4: Push to Deploy

```bash
git add .
git commit -m "Deploy to GitHub Pages"
git push origin main
```

That's it! Your dashboard will be live at:
`https://your-username.github.io/MuseRoom-Dashboard/`

## 🎯 Configure Your Notion Workspace

Once your dashboard is deployed:

1. **Visit your live site**
2. **Click the Notion Workspace tab**
3. **Click "Configure Workspace"**
4. **Enter your company's Notion workspace URL**:
   ```
   https://www.notion.so/your-company-workspace
   ```
5. **Click "Configure Workspace"**

Now everyone on your team can access the same workspace!

## 📝 Customize Your Pages

Edit the workspace pages in `src/components/NotionWorkspace.tsx`:

```typescript
const companyPages: NotionPage[] = [
  {
    id: "1",
    title: "Team Documentation", // ← Change this
    icon: "📚", // ← Change this emoji
    url: `${customWorkspaceUrl}/Your-Actual-Page`, // ← Your real page URL
    description: "Your actual page description", // ← Your description
  },
  // Add more pages here...
];
```

## 🌐 Custom Domain (Optional)

Want `dashboard.yourcompany.com` instead of GitHub's URL?

1. **Buy a domain** (from Namecheap, GoDaddy, etc.)
2. **In GitHub Settings > Pages**:
   - Add your custom domain
   - Enable "Enforce HTTPS"
3. **In your domain provider**:
   - Add CNAME record pointing to `your-username.github.io`

## 🎨 Customization Ideas

### Change Colors

Edit the purple/pink theme in `src/index.css`:

```css
/* Change to your company colors */
.bg-gradient-to-br {
  background: linear-gradient(
    to bottom right,
    your-color-1,
    your-color-2,
    your-color-3
  );
}
```

### Add Your Logo

Replace the AI animation with your company logo:

```tsx
// In src/App.tsx, replace the GIF with:
<img src="/your-logo.png" alt="Company Logo" />
```

### Customize Welcome Message

Edit the greeting in `src/components/VoiceAgent.tsx`:

```typescript
return `Welcome to ${YOUR_COMPANY_NAME} Dashboard! 
I'm your AI assistant...`;
```

## 📊 Features That Work on GitHub Pages

✅ **Voice/Text AI Assistant** - Full functionality  
✅ **Discord Integration** - Works with webhooks  
✅ **Notion Workspace Links** - Direct access to your workspace  
✅ **ElevenLabs Voice** - Premium AI voices  
✅ **Beautiful UI** - Purple/pink glow effects  
✅ **Mobile Responsive** - Works on all devices

## ❌ What Doesn't Work (but you don't need it!)

- Complex OAuth flows (not needed for simple workspace access)
- User databases (everyone accesses the same workspace)
- Server-side processing (all client-side)

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

## 🚀 Deployment Workflow

The included GitHub Action (`.github/workflows/deploy.yml`) automatically:

1. **Builds** your app when you push to main
2. **Deploys** to GitHub Pages
3. **Updates** your live site instantly

## 💰 Cost

**$0/month** - Completely free!

- GitHub Pages: Free for public repositories
- Custom domain: ~$10-15/year (optional)
- ElevenLabs: Free tier available

## 🆘 Troubleshooting

### Site not updating?

- Check the **Actions** tab for build errors
- Make sure you pushed to the `main` branch

### 404 errors?

- Verify GitHub Pages is enabled in Settings
- Check that source is set to "GitHub Actions"

### Notion links not working?

- Make sure your workspace URL is correct
- Ensure your Notion workspace is accessible to your team

## 🎉 You're Done!

Your team now has a beautiful, professional dashboard at:
`https://your-username.github.io/MuseRoom-Dashboard/`

Share this URL with your team and they can:

- Use the AI voice/text assistant
- Access your company Notion workspace
- View Discord messages
- Enjoy the beautiful purple/pink UI

## 🔗 Useful Links

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Custom Domain Setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [Notion Workspace Sharing](https://www.notion.so/help/share-and-publish-with-web)

Need help? Open an issue in your repository! 🤝
