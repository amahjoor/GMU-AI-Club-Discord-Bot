const { Client, GatewayIntentBits, Collection, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Import event manager
const EventManager = require('./eventManager');
const eventManager = new EventManager();

// Import commands
const commands = require('./commands');

// Bot ready event
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is online and ready!`);
    console.log(`🤖 Bot is in ${client.guilds.cache.size} server(s)`);
    
    // Register slash commands
    try {
        if (process.env.GUILD_ID) {
            // Register to specific guild (faster updates, good for development)
            const guild = client.guilds.cache.get(process.env.GUILD_ID);
            if (guild) {
                await guild.commands.set(commands.map(cmd => cmd.data));
                console.log('✅ Slash commands registered to guild successfully!');
            }
        } else {
            // Register globally (works in all servers, takes up to 1 hour to update)
            await client.application.commands.set(commands.map(cmd => cmd.data));
            console.log('✅ Slash commands registered globally successfully!');
        }
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }

    // Start schedulers
    startSchedulers();
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.find(cmd => cmd.data.name === interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, eventManager);
    } catch (error) {
        console.error('❌ Command execution error:', error);
        const reply = { content: 'There was an error executing this command!', ephemeral: true };
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
        } else {
            await interaction.reply(reply);
        }
    }
});

// Scheduler functions
function startSchedulers() {
    console.log('🕐 Starting event schedulers...');
    
    // Check for 7-day advance announcements (runs daily at 9:00 AM)
    cron.schedule('0 9 * * *', () => {
        checkForAdvanceAnnouncements();
    }, {
        timezone: process.env.TIMEZONE || 'America/New_York'
    });

    // Check for same-day reminders (runs every 15 minutes to catch 3-hour windows)
    cron.schedule('*/15 * * * *', () => {
        checkForTodayReminders();
    }, {
        timezone: process.env.TIMEZONE || 'America/New_York'
    });

    // Catch-up check - runs every hour to catch missed announcements
    cron.schedule('0 * * * *', () => {
        checkForMissedAnnouncements();
    }, {
        timezone: process.env.TIMEZONE || 'America/New_York'
    });

    console.log('✅ Schedulers started successfully!');
    
    // Run initial catch-up check when bot starts
    setTimeout(() => {
        console.log('🔍 Running initial catch-up check...');
        checkForMissedAnnouncements();
    }, 5000); // Wait 5 seconds for bot to fully initialize
}

async function checkForAdvanceAnnouncements() {
    console.log('🔍 Checking for advance announcements...');
    
    const daysAhead = parseInt(process.env.ANNOUNCEMENT_DAYS_AHEAD) || 7;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);
    
    const events = eventManager.getEventsForDate(targetDate);
    
    for (const event of events) {
        if (!event.announcementSent) {
            await sendEventAnnouncement(event, false);
            eventManager.markAnnouncementSent(event.id);
        }
    }
}

async function checkForTodayReminders() {
    console.log('🔍 Checking for 3-hour event reminders...');
    
    const now = new Date();
    const today = new Date(now);
    const events = eventManager.getEventsForDate(today);
    
    for (const event of events) {
        if (!event.reminderSent && event.time) {
            // Parse event time
            const eventDateTime = parseEventDateTime(event.date, event.time);
            if (!eventDateTime) continue;
            
            // Calculate time difference in hours
            const timeDiffHours = (eventDateTime - now) / (1000 * 60 * 60);
            
            // Send reminder if we're within 3 hours and 15 minutes of the event
            if (timeDiffHours <= 3 && timeDiffHours > 2.75) {
                console.log(`📢 Sending 3-hour reminder for: ${event.title}`);
                await sendEventReminder(event);
                eventManager.markReminderSent(event.id);
            }
        }
    }
}

async function checkForMissedAnnouncements() {
    console.log('🔍 Checking for missed announcements...');
    
    try {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // Get announcement settings
        const daysAhead = parseInt(process.env.ANNOUNCEMENT_DAYS_AHEAD) || 7;
        const reminderTime = process.env.REMINDER_TIME || '10:15';
        const [reminderHour, reminderMinute] = reminderTime.split(':').map(Number);
        
        // Check for missed advance announcements
        await checkMissedAdvanceAnnouncements(now, daysAhead);
        
        // Check for missed same-day reminders (3-hour based system)
        await checkMissedTodayReminders(now);
        
    } catch (error) {
        console.error('❌ Error in missed announcements check:', error);
    }
}

async function checkMissedAdvanceAnnouncements(now, daysAhead) {
    // Check if we missed any advance announcements (should have been sent by 9:00 AM)
    const shouldHaveAnnouncedBy = new Date(now);
    shouldHaveAnnouncedBy.setHours(9, 0, 0, 0);
    
    if (now >= shouldHaveAnnouncedBy) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + daysAhead);
        
        const events = eventManager.getEventsForDate(targetDate);
        
        for (const event of events) {
            if (!event.announcementSent) {
                console.log(`📢 Sending missed advance announcement for: ${event.title}`);
                await sendEventAnnouncement(event, false);
                eventManager.markAnnouncementSent(event.id);
            }
        }
    }
}

async function checkMissedTodayReminders(now) {
    // Check today's events for missed 3-hour reminders
    const events = eventManager.getEventsForDate(now);
    
    for (const event of events) {
        if (!event.reminderSent && event.time) {
            const eventDateTime = parseEventDateTime(event.date, event.time);
            if (!eventDateTime) continue;
            
            // Calculate time difference in hours
            const timeDiffHours = (eventDateTime - now) / (1000 * 60 * 60);
            
            // If event is in the past or happening very soon, send missed reminder
            if (timeDiffHours <= 3 && timeDiffHours > -1) { // Event within 3 hours or up to 1 hour past
                console.log(`🚨 Sending missed 3-hour reminder for: ${event.title}`);
                await sendEventReminder(event);
                eventManager.markReminderSent(event.id);
            }
        }
    }
}

async function sendEventAnnouncement(event, isReminder = false) {
    try {
        const channel = client.channels.cache.get(process.env.ANNOUNCEMENTS_CHANNEL_ID);
        if (!channel) {
            console.error('❌ Announcements channel not found!');
            return;
        }

        // Create natural text message
        const daysUntil = getDaysUntil(event.date);
        const eventDate = formatDate(event.date);
        
        let messageText;
        if (isReminder) {
            messageText = `🚨 **Event Reminder - Today!**\n\n`;
            messageText += `**${event.title}** is happening today!\n\n`;
        } else {
            messageText = `📅 **Upcoming Event**\n\n`;
            messageText += `**${event.title}** is coming up in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}!\n\n`;
        }

        messageText += `${event.description}\n\n`;
        messageText += `📅 **Date:** ${eventDate}\n`;
        messageText += `🕐 **Time:** ${event.time}\n`;
        messageText += `📍 **Location:** ${event.location}\n`;

        if (isReminder) {
            messageText += `\nDon't miss it! 🎉`;
        } else {
            messageText += `\nMark your calendars! 📝`;
        }

        const messageOptions = { content: messageText };

        // Add image if available
        if (event.imagePath && fs.existsSync(event.imagePath)) {
            const attachment = new AttachmentBuilder(event.imagePath);
            messageOptions.files = [attachment];
        }

        await channel.send(messageOptions);
        console.log(`✅ ${isReminder ? 'Reminder' : 'Announcement'} sent for event: ${event.title}`);

    } catch (error) {
        console.error('❌ Error sending announcement:', error);
    }
}

async function sendEventReminder(event) {
    try {
        const channel = client.channels.cache.get(process.env.ANNOUNCEMENTS_CHANNEL_ID);
        if (!channel) {
            console.error('❌ Announcements channel not found!');
            return;
        }

        // Create the casual reminder message you requested
        const messageText = `We have our **${event.title}** today at **${event.time}** in **${event.location}**. Hope to see you there!`;

        const messageOptions = { content: messageText };

        // Add image if available
        if (event.imagePath && fs.existsSync(event.imagePath)) {
            const attachment = new AttachmentBuilder(event.imagePath);
            messageOptions.files = [attachment];
        }

        await channel.send(messageOptions);
        console.log(`✅ 3-hour reminder sent for event: ${event.title}`);

    } catch (error) {
        console.error('❌ Error sending reminder:', error);
    }
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function getDaysUntil(dateString) {
    const eventDate = new Date(dateString);
    const today = new Date();
    const diffTime = eventDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function parseEventDateTime(dateString, timeString) {
    try {
        // Parse the date
        const eventDate = new Date(dateString);
        if (isNaN(eventDate.getTime())) return null;
        
        // Parse the time (supports formats like "7:00 PM", "19:00", "7 PM", etc.)
        const timeRegex = /^(\d{1,2}):?(\d{0,2})\s*(AM|PM)?$/i;
        const match = timeString.trim().match(timeRegex);
        
        if (!match) return null;
        
        let hours = parseInt(match[1]);
        const minutes = parseInt(match[2] || '0');
        const ampm = match[3] ? match[3].toUpperCase() : null;
        
        // Convert to 24-hour format
        if (ampm === 'PM' && hours !== 12) {
            hours += 12;
        } else if (ampm === 'AM' && hours === 12) {
            hours = 0;
        }
        
        // Set the time on the event date
        const eventDateTime = new Date(eventDate);
        eventDateTime.setHours(hours, minutes, 0, 0);
        
        return eventDateTime;
    } catch (error) {
        console.error('Error parsing event date/time:', error);
        return null;
    }
}

// Keep-alive for platforms that spin down (like Render)
function startKeepAlive() {
    if (process.env.KEEP_ALIVE === 'true') {
        const http = require('http');
        const port = process.env.PORT || 3000;
        
        // Simple HTTP server for health checks
        const server = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('GMU AI Club Bot is alive!');
        });
        
        server.listen(port, () => {
            console.log(`🌐 Keep-alive server running on port ${port}`);
        });
        
        // Self-ping every 10 minutes to prevent spin down
        setInterval(() => {
            if (process.env.RENDER_EXTERNAL_URL) {
                const https = require('https');
                https.get(process.env.RENDER_EXTERNAL_URL, (res) => {
                    console.log('🔄 Keep-alive ping sent');
                }).on('error', (err) => {
                    console.log('⚠️ Keep-alive ping failed:', err.message);
                });
            }
        }, 10 * 60 * 1000); // 10 minutes
    }
}

// Error handling
process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

// Start keep-alive if needed
startKeepAlive();

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN);
