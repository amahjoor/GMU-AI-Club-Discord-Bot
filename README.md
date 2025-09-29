# GMU AI Club Discord Bot

A Discord bot designed for the GMU AI Club to automatically handle event announcements and reminders.

## Features

🎯 **Automated Event Management**
- Posts event announcements 7 days in advance
- Sends event reminders at 10:15 AM on the event day
- Supports event images/posters
- Persistent event storage

🤖 **Slash Commands**
- `/add-event` - Create new events with images
- `/list-events` - View upcoming events
- `/delete-event` - Remove events
- `/bot-info` - Display bot statistics

## Setup Instructions

### 1. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section
4. Click "Add Bot"
5. Copy the bot token (keep it secret!)
6. Under "Privileged Gateway Intents", enable:
   - Message Content Intent
   - Server Members Intent (optional)

### 2. Bot Permissions

Your bot needs these permissions:
- `Send Messages`
- `Use Slash Commands`
- `Attach Files`
- `Embed Links`
- `Manage Events` (for admin commands)

**Permission Integer:** `274877959168`

### 3. Invite Bot to Server (Owner Only)

**⚠️ IMPORTANT: This bot is configured for invite-only access.**

To make your bot invite-only:
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your bot → "Bot" section
3. **Turn OFF** "Public Bot" setting
4. Optionally **Turn ON** "Requires OAuth2 Code Grant" for extra security

**Your private invite URL** (replace YOUR_CLIENT_ID with your bot's client ID):
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274877959168&scope=bot%20applications.commands
```

**Note:** Only you (the bot owner) can use this invite link when "Public Bot" is disabled.

### 4. Get Required IDs

**Server ID (Guild ID):**
1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click your server name → Copy Server ID

**Channel ID:**
1. Right-click your #announcements channel → Copy Channel ID

### 5. Installation

1. **Clone/Download** this project
2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   - Copy `env.example` to `.env`
   - Fill in your bot token and IDs:
   ```env
   DISCORD_BOT_TOKEN=your_bot_token_here
   GUILD_ID=your_server_id_here
   ANNOUNCEMENTS_CHANNEL_ID=your_announcements_channel_id_here
   
   ANNOUNCEMENT_DAYS_AHEAD=7
   REMINDER_TIME=10:15
   TIMEZONE=America/New_York
   ```

   **Command Registration Options:**
   - **Guild-specific (faster):** Keep `GUILD_ID` - commands only work in that server
   - **Global (all servers):** Remove `GUILD_ID` line - commands work everywhere (takes up to 1 hour)

4. **Start the bot:**
   ```bash
   npm start
   ```

## Usage

### Adding Events

Use the `/add-event` command with these parameters:
- **title:** Event name
- **description:** Event details
- **date:** Event date (YYYY-MM-DD format)
- **time:** Event time (optional)
- **location:** Event location (optional)
- **image:** Event poster/image (optional)

Example:
```
/add-event title:"AI Workshop" description:"Learn about machine learning basics" date:"2024-04-15" time:"2:00 PM" location:"Innovation Hall 206"
```

### Managing Events

- **View events:** `/list-events`
- **Delete events:** `/delete-event title:"Event Name"`
- **Bot info:** `/bot-info`

## How It Works

### Automatic Scheduling

The bot runs two scheduled tasks:

1. **Daily at 9:00 AM:** Checks for events happening in 7 days and posts announcements
2. **Daily at 10:15 AM:** Checks for events happening today and sends reminders

### Event Storage

- Events are stored in `events.json`
- Images are saved in the `images/` directory
- Each event tracks whether announcements and reminders have been sent

### Event Lifecycle

1. **Event Created** → Stored with `announcementSent: false`, `reminderSent: false`
2. **7 Days Before** → Announcement posted, marked as `announcementSent: true`
3. **Event Day at 10:15 AM** → Reminder posted, marked as `reminderSent: true`

## File Structure

```
GMU AI CLUB DISCORD BOT/
├── bot.js                 # Main bot file
├── eventManager.js        # Event management system
├── commands.js           # Slash command definitions
├── package.json          # Dependencies
├── env.example          # Environment template
├── events.json          # Event storage (auto-created)
├── images/              # Event images (auto-created)
└── README.md            # This file
```

## Customization

### Changing Schedule Times

Edit the cron expressions in `bot.js`:

```javascript
// Change announcement time (currently 9:00 AM)
cron.schedule('0 9 * * *', () => {
    checkForAdvanceAnnouncements();
});

// Change reminder time via environment variable
REMINDER_TIME=10:15
```

### Changing Days Ahead

Modify the `ANNOUNCEMENT_DAYS_AHEAD` environment variable:
```env
ANNOUNCEMENT_DAYS_AHEAD=5  # Post announcements 5 days ahead instead of 7
```

### Timezone Configuration

Set your timezone in the environment file:
```env
TIMEZONE=America/Los_Angeles  # Pacific Time
TIMEZONE=America/Chicago      # Central Time
TIMEZONE=America/New_York     # Eastern Time (default)
```

## Troubleshooting

### Common Issues

1. **Bot not responding to commands:**
   - Check if bot is online in Discord
   - Verify bot has proper permissions
   - Check console for error messages

2. **Commands not appearing:**
   - Make sure `GUILD_ID` is correct
   - Restart the bot to re-register commands
   - Check bot permissions include "Use Slash Commands"

3. **Announcements not posting:**
   - Verify `ANNOUNCEMENTS_CHANNEL_ID` is correct
   - Check bot has "Send Messages" permission in that channel
   - Look for error messages in console

4. **Images not working:**
   - Ensure image file types are supported (JPG, PNG, GIF, WebP)
   - Check file size limits (Discord has 8MB limit)
   - Verify bot has "Attach Files" permission

### Logs and Debugging

The bot logs important events to console:
- ✅ Success messages
- ❌ Error messages
- 🔍 Scheduled task executions
- 📅 Event operations

## Support

For issues or questions:
1. Check the console logs for error messages
2. Verify all environment variables are set correctly
3. Ensure bot permissions are properly configured
4. Make sure Discord Developer Portal settings match your setup

## License

MIT License - Feel free to modify and use for your own club/organization!
