const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

async function testAdvanceAnnouncements(client, eventManager, interaction = null) {
    try {
        const daysAhead = parseInt(process.env.ANNOUNCEMENT_DAYS_AHEAD) || 7;
        
        // Get all events within the next 7 days that need announcements
        const upcomingEvents = [];
        const today = new Date();
        
        for (let i = 1; i <= daysAhead; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() + i);
            
            const dayEvents = eventManager.getEventsForDate(checkDate);
            for (const event of dayEvents) {
                if (!event.announcementSent) {
                    upcomingEvents.push({
                        ...event,
                        daysAhead: i,
                        dateString: checkDate.toDateString()
                    });
                }
            }
        }
        
        if (upcomingEvents.length === 0) {
            return `No events found in the next ${daysAhead} days that need announcements`;
        }

        // If multiple events and we have an interaction, let user choose
        // Also show selection if only 1 event but user specifically requested selection
        if (interaction && (upcomingEvents.length > 1 || upcomingEvents.length === 1)) {
            return await handleMultipleEventSelection(client, upcomingEvents, interaction, false);
        }

        // If single event or no interaction, send all
        let results = [];
        for (const event of upcomingEvents) {
            const result = await sendTestAnnouncement(client, event, false);
            results.push(`• ${event.title} (${event.daysAhead} days): ${result}`);
        }
        
        return `Found ${upcomingEvents.length} event(s) needing announcements:\n${results.join('\n')}`;
        
    } catch (error) {
        console.error('Error in testAdvanceAnnouncements:', error);
        return `Error: ${error.message}`;
    }
}

async function testTodayReminders(client, eventManager, interaction = null) {
    try {
        const today = new Date();
        const events = eventManager.getEventsForDate(today).filter(event => !event.reminderSent);
        
        if (events.length === 0) {
            return `No events found for today (${today.toDateString()}) that need reminders`;
        }

        // If events found and we have an interaction, let user choose
        if (interaction && events.length >= 1) {
            return await handleMultipleEventSelection(client, events, interaction, true);
        }

        // If single event or no interaction, send all
        let results = [];
        for (const event of events) {
            const result = await sendTestAnnouncement(client, event, true);
            results.push(`• ${event.title}: ${result}`);
        }
        
        return `Found ${events.length} event(s) for today:\n${results.join('\n')}`;
        
    } catch (error) {
        console.error('Error in testTodayReminders:', error);
        return `Error: ${error.message}`;
    }
}

async function handleMultipleEventSelection(client, events, interaction, isReminder) {
    const { StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
    
    try {
        // Create selection menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('event_selection')
            .setPlaceholder('Choose events to test...')
            .setMinValues(1)
            .setMaxValues(Math.min(events.length, 25)); // Discord limit

        // Add options for each event
        events.forEach((event, index) => {
            const label = event.title.length > 100 ? event.title.substring(0, 97) + '...' : event.title;
            const description = isReminder ? 
                `Today - ${event.time}` : 
                `${event.daysAhead} days - ${formatDate(event.date)}`;
            
            selectMenu.addOptions({
                label: label,
                description: description.length > 100 ? description.substring(0, 97) + '...' : description,
                value: event.id
            });
        });

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setTitle(`🔍 ${events.length === 1 ? 'Event Found' : 'Multiple Events Found'}`)
            .setDescription(`Found ${events.length} event${events.length === 1 ? '' : 's'} that need${events.length === 1 ? 's' : ''} ${isReminder ? 'reminders' : 'announcements'}. Select which one${events.length === 1 ? '' : 's'} to test:`)
            .setColor('#FFA726')
            .addFields(
                events.map(event => ({
                    name: event.title,
                    value: isReminder ? 
                        `Today at ${event.time}` : 
                        `${event.daysAhead} days away (${formatDate(event.date)})`,
                    inline: true
                }))
            );

        const response = await interaction.editReply({ 
            embeds: [embed], 
            components: [row] 
        });

        // Wait for user selection
        const filter = (i) => i.customId === 'event_selection' && i.user.id === interaction.user.id;
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            filter, 
            time: 60000 
        });

        return new Promise((resolve) => {
            collector.on('collect', async (i) => {
                const selectedEventIds = i.values;
                const selectedEvents = events.filter(event => selectedEventIds.includes(event.id));
                
                let results = [];
                for (const event of selectedEvents) {
                    const result = await sendTestAnnouncement(client, event, isReminder);
                    const dayInfo = isReminder ? 'today' : `${event.daysAhead} days`;
                    results.push(`• ${event.title} (${dayInfo}): ${result}`);
                }

                const resultEmbed = new EmbedBuilder()
                    .setTitle('🧪 Test Results')
                    .setDescription(`Tested ${selectedEvents.length} event(s):\n${results.join('\n')}`)
                    .setColor('#4ECDC4')
                    .setTimestamp();

                await i.update({ embeds: [resultEmbed], components: [] });
                collector.stop();
                resolve(`Selected and tested ${selectedEvents.length} events`);
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.editReply({ 
                        content: '⏰ Selection timed out. No tests were run.', 
                        embeds: [], 
                        components: [] 
                    });
                    resolve('Selection timed out');
                }
            });
        });

    } catch (error) {
        console.error('Error in handleMultipleEventSelection:', error);
        return `Error handling selection: ${error.message}`;
    }
}

async function sendTestAnnouncement(client, event, isReminder = false) {
    try {
        const channel = client.channels.cache.get(process.env.ANNOUNCEMENTS_CHANNEL_ID);
        if (!channel) {
            return '❌ Announcements channel not found';
        }

        // Create natural text message for testing
        const daysUntil = getDaysUntil(event.date);
        const eventDate = formatDate(event.date);
        
        let messageText = `🧪 **TEST** - `;
        if (isReminder) {
            messageText += `🚨 **Event Reminder - Today!**\n\n`;
            messageText += `**${event.title}** is happening today!\n\n`;
        } else {
            messageText += `📅 **Upcoming Event**\n\n`;
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

        messageText += `\n\n*This was a test announcement*`;

        const messageOptions = { content: messageText };

        // Add image if available
        if (event.imagePath && fs.existsSync(event.imagePath)) {
            const attachment = new AttachmentBuilder(event.imagePath);
            messageOptions.files = [attachment];
        }

        await channel.send(messageOptions);
        return '✅ Test sent successfully';

    } catch (error) {
        console.error('Error sending test announcement:', error);
        return `❌ Error: ${error.message}`;
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
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    
    const diffTime = eventDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

module.exports = {
    testAdvanceAnnouncements,
    testTodayReminders
};
