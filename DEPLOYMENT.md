# Deployment Guide

This guide covers how to deploy your GMU AI Club Discord Bot to various hosting platforms.

## 🚀 Quick Deploy: Railway (Recommended)

Railway is the easiest and most reliable option for hosting Discord bots.

### Step 1: Prepare Your Code

1. **Make sure all files are ready:**
   ```bash
   npm install  # Install dependencies locally first
   ```

2. **Create a GitHub repository:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: GMU AI Club Discord Bot"
   ```

3. **Push to GitHub:**
   - Create a new repository on GitHub
   - Follow GitHub's instructions to push your code

### Step 2: Deploy on Railway

1. **Sign up for Railway:**
   - Go to [railway.app](https://railway.app)
   - Sign up with your GitHub account

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your bot repository
   - Railway will auto-detect it's a Node.js project

3. **Configure Environment Variables:**
   In Railway dashboard:
   - Go to your project
   - Click "Variables" tab
   - Add these variables:
   
   ```
   DISCORD_BOT_TOKEN=your_actual_bot_token
   GUILD_ID=your_server_id
   ANNOUNCEMENTS_CHANNEL_ID=your_channel_id
   GOOGLE_SHEETS_ID=your_sheet_id
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
   GOOGLE_PRIVATE_KEY=your_private_key_with_newlines
   ANNOUNCEMENT_DAYS_AHEAD=7
   REMINDER_TIME=10:15
   TIMEZONE=America/New_York
   ```

4. **Deploy:**
   - Railway automatically builds and deploys
   - Your bot will be online in ~2-3 minutes
   - Check the logs to make sure it started successfully

### Step 3: Verify Deployment

1. **Check Railway logs** for "✅ Bot is online and ready!"
2. **Test in Discord** with `/bot-info`
3. **Import your events** with `/sync-events`

---

## 🔧 Alternative: Heroku

### Prerequisites:
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
- Heroku account

### Steps:

1. **Login to Heroku:**
   ```bash
   heroku login
   ```

2. **Create Heroku app:**
   ```bash
   heroku create gmu-ai-club-bot
   ```

3. **Set environment variables:**
   ```bash
   heroku config:set DISCORD_BOT_TOKEN=your_token
   heroku config:set GUILD_ID=your_guild_id
   heroku config:set ANNOUNCEMENTS_CHANNEL_ID=your_channel_id
   heroku config:set GOOGLE_SHEETS_ID=your_sheet_id
   heroku config:set GOOGLE_SERVICE_ACCOUNT_EMAIL=your_email
   heroku config:set GOOGLE_PRIVATE_KEY="your_private_key"
   heroku config:set ANNOUNCEMENT_DAYS_AHEAD=7
   heroku config:set REMINDER_TIME=10:15
   heroku config:set TIMEZONE=America/New_York
   ```

4. **Deploy:**
   ```bash
   git push heroku main
   ```

5. **Scale worker:**
   ```bash
   heroku ps:scale worker=1
   ```

---

## 💰 Cost Comparison

| Platform | Free Tier | Paid Plans | Best For |
|----------|-----------|------------|----------|
| **Railway** | 500 hours/month | $5/month | Beginners, easy setup |
| **Heroku** | 550 hours/month | $7/month | Popular choice |
| **DigitalOcean** | None | $4/month | More control |
| **VPS** | None | $2.50+/month | Advanced users |

---

## 🛠️ Deployment Checklist

Before deploying, make sure:

- [ ] All dependencies are in `package.json`
- [ ] Environment variables are configured
- [ ] Google Sheets API is set up
- [ ] Discord bot has proper permissions
- [ ] Bot token is kept secure
- [ ] `.gitignore` excludes sensitive files

---

## 🔍 Troubleshooting

### Bot Not Starting:
1. Check environment variables are set correctly
2. Verify Discord bot token is valid
3. Ensure Google Sheets credentials are properly formatted
4. Check platform logs for error messages

### Commands Not Working:
1. Make sure bot has proper Discord permissions
2. Verify `GUILD_ID` is correct for global vs guild commands
3. Check if slash commands are registered

### Google Sheets Errors:
1. Verify service account has access to the sheet
2. Check that `GOOGLE_PRIVATE_KEY` includes `\n` characters
3. Ensure Google Sheets API is enabled

---

## 🔄 Updating Your Bot

### Railway (Auto-deploy):
- Just push to GitHub: `git push origin main`
- Railway automatically redeploys

### Heroku:
```bash
git push heroku main
```

### Manual VPS:
1. SSH into server
2. Pull latest code: `git pull`
3. Restart: `pm2 restart bot`

---

## 🎯 Best Practices

1. **Use environment variables** for all sensitive data
2. **Never commit** `.env` files or tokens
3. **Monitor logs** regularly for errors
4. **Set up alerts** for when bot goes offline
5. **Keep dependencies updated** for security

---

## 📞 Support

If you encounter issues:
1. Check the platform's logs first
2. Verify all environment variables
3. Test locally before deploying
4. Check Discord Developer Portal for bot status

Your bot should now be running 24/7 and handling all announcements automatically! 🎉
