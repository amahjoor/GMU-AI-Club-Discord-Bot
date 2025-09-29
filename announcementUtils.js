const { EmbedBuilder, AttachmentBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');

async function sendAdvanceAnnouncements(client, eventManager, interaction = null) {
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
            if (interaction) {
                const embed = new EmbedBuilder()
                    .setTitle('📅 No Announcements Needed')
                    .setDescription(`No events found in the next ${daysAhead} days that need advance announcements.`)
                    .setColor('#FFA726');
                await interaction.editReply({ embeds: [embed] });
            }
            return `No events found in the next ${daysAhead} days that need announcements`;
        }

        // Always show selection if we have an interaction
        if (interaction) {
            return await handleEventSelection(client, upcomingEvents, interaction, false, eventManager);
        }

        // If no interaction, send all (for automated system)
        let results = [];
        for (const event of upcomingEvents) {
            const result = await sendRealAnnouncement(client, event, false, eventManager);
            results.push(`• ${event.title} (${event.daysAhead} days): ${result}`);
        }
        
        return `Sent ${upcomingEvents.length} advance announcement(s):\n${results.join('\n')}`;
        
    } catch (error) {
        console.error('Error in sendAdvanceAnnouncements:', error);
        return `Error: ${error.message}`;
    }
}

async function sendTodayReminders(client, eventManager, interaction = null) {
    try {
        const today = new Date();
        const events = eventManager.getEventsForDate(today).filter(event => !event.reminderSent);
        
        if (events.length === 0) {
            if (interaction) {
                const embed = new EmbedBuilder()
                    .setTitle('🚨 No Reminders Needed')
                    .setDescription(`No events found for today (${today.toDateString()}) that need reminders.`)
                    .setColor('#FFA726');
                await interaction.editReply({ embeds: [embed] });
            }
            return `No events found for today that need reminders`;
        }

        // Always show selection if we have an interaction
        if (interaction) {
            return await handleEventSelection(client, events, interaction, true, eventManager);
        }

        // If no interaction, send all (for automated system)
        let results = [];
        for (const event of events) {
            const result = await sendRealAnnouncement(client, event, true, eventManager);
            results.push(`• ${event.title}: ${result}`);
        }
        
        return `Sent ${events.length} reminder(s) for today:\n${results.join('\n')}`;
        
    } catch (error) {
        console.error('Error in sendTodayReminders:', error);
        return `Error: ${error.message}`;
    }
}

async function handleEventSelection(client, events, interaction, isReminder, eventManager) {
    try {
        // Create selection menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('event_selection')
            .setPlaceholder('Choose events to announce...')
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
            .setTitle(`📢 ${events.length === 1 ? 'Event Ready' : 'Events Ready'} for ${isReminder ? 'Reminders' : 'Announcements'}`)
            .setDescription(`Found ${events.length} event${events.length === 1 ? '' : 's'} ready for ${isReminder ? 'reminders' : 'announcements'}. Select which one${events.length === 1 ? '' : 's'} to send:`)
            .setColor('#4ECDC4')
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
                    const result = await sendRealAnnouncement(client, event, isReminder, eventManager);
                    const dayInfo = isReminder ? 'today' : `${event.daysAhead} days`;
                    results.push(`• ${event.title} (${dayInfo}): ${result}`);
                }

                const resultEmbed = new EmbedBuilder()
                    .setTitle('📢 Announcements Sent!')
                    .setDescription(`Successfully sent ${selectedEvents.length} ${isReminder ? 'reminder(s)' : 'announcement(s)'}:\n\n${results.join('\n')}`)
                    .setColor('#4ECDC4')
                    .setFooter({ 
                        text: `Sent by ${i.user.tag}`,
                        iconURL: i.user.displayAvatarURL()
                    })
                    .setTimestamp();

                await i.update({ embeds: [resultEmbed], components: [] });
                collector.stop();
                resolve(`Sent ${selectedEvents.length} announcements`);
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.editReply({ 
                        content: '⏰ Selection timed out. No announcements were sent.', 
                        embeds: [], 
                        components: [] 
                    });
                    resolve('Selection timed out');
                }
            });
        });

    } catch (error) {
        console.error('Error in handleEventSelection:', error);
        return `Error handling selection: ${error.message}`;
    }
}

async function sendRealAnnouncement(client, event, isReminder = false, eventManager) {
    try {
        const channel = client.channels.cache.get(process.env.ANNOUNCEMENTS_CHANNEL_ID);
        if (!channel) {
            return '❌ Announcements channel not found';
        }

        let messageText;
        
        if (isReminder) {
            // Use the casual 3-hour reminder format
            messageText = `We have our **${event.title}** today at **${event.time}** in **${event.location}**. Hope to see you there!`;
        } else {
            // Use the advance announcement format
            const daysUntil = getDaysUntil(event.date);
            const eventDate = formatDate(event.date);
            
            messageText = `📅 **Upcoming Event**\n\n`;
            messageText += `**${event.title}** is coming up in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}!\n\n`;
            messageText += `${event.description}\n\n`;
            messageText += `📅 **Date:** ${eventDate}\n`;
            messageText += `🕐 **Time:** ${event.time}\n`;
            messageText += `📍 **Location:** ${event.location}\n`;
            messageText += `\nMark your calendars! 📝`;
        }

        const messageOptions = { content: messageText };

        // Add image if available
        if (event.imagePath && fs.existsSync(event.imagePath)) {
            const attachment = new AttachmentBuilder(event.imagePath);
            messageOptions.files = [attachment];
        }

        await channel.send(messageOptions);
        
        // Mark as sent in the database
        if (isReminder) {
            eventManager.markReminderSent(event.id);
        } else {
            eventManager.markAnnouncementSent(event.id);
        }
        
        console.log(`✅ Real ${isReminder ? 'reminder' : 'announcement'} sent for event: ${event.title}`);
        return '✅ Sent successfully';

    } catch (error) {
        console.error('Error sending real announcement:', error);
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
    sendAdvanceAnnouncements,
    sendTodayReminders
};
