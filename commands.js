const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [
    {
        data: new SlashCommandBuilder()
            .setName('add-event')
            .setDescription('Add a new event to the calendar')
            .addStringOption(option =>
                option.setName('title')
                    .setDescription('Event title')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('description')
                    .setDescription('Event description')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('date')
                    .setDescription('Event date (YYYY-MM-DD format)')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('time')
                    .setDescription('Event time (e.g., 2:00 PM)')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('location')
                    .setDescription('Event location')
                    .setRequired(true))
            .addAttachmentOption(option =>
                option.setName('image')
                    .setDescription('Event image/poster')
                    .setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

        async execute(interaction, eventManager) {
            await interaction.deferReply({ ephemeral: true });

            try {
                const title = interaction.options.getString('title');
                const description = interaction.options.getString('description');
                const dateString = interaction.options.getString('date');
                const time = interaction.options.getString('time');
                const location = interaction.options.getString('location');
                const imageAttachment = interaction.options.getAttachment('image');

                // Validate date format
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(dateString)) {
                    await interaction.editReply('❌ Invalid date format! Please use YYYY-MM-DD format (e.g., 2024-03-15)');
                    return;
                }

                const eventDate = new Date(dateString);
                if (isNaN(eventDate.getTime())) {
                    await interaction.editReply('❌ Invalid date! Please check your date format.');
                    return;
                }

                // Check if date is in the past (compare date strings to avoid timezone issues)
                const today = new Date();
                const todayDateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
                
                if (dateString < todayDateString) {
                    await interaction.editReply('❌ Cannot create events for past dates!');
                    return;
                }

                let imagePath = null;

                // Handle image upload
                if (imageAttachment) {
                    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                    if (!allowedTypes.includes(imageAttachment.contentType)) {
                        await interaction.editReply('❌ Invalid image format! Please use JPG, PNG, GIF, or WebP.');
                        return;
                    }

                    // Download and save image
                    try {
                        const response = await fetch(imageAttachment.url);
                        const buffer = Buffer.from(await response.arrayBuffer());
                        
                        const fileName = `${Date.now()}_${imageAttachment.name}`;
                        imagePath = eventManager.saveEventImage(buffer, fileName);
                    } catch (error) {
                        console.error('Error saving image:', error);
                        await interaction.editReply('❌ Error saving image. Event created without image.');
                    }
                }

                // Create event
                const eventData = {
                    title,
                    description,
                    date: dateString,
                    time,
                    location,
                    imagePath,
                    createdBy: interaction.user.id
                };

                const newEvent = eventManager.addEvent(eventData);

                // Create success embed
                const embed = new EmbedBuilder()
                    .setTitle('✅ Event Created Successfully!')
                    .setDescription(`**${title}** has been added to the calendar`)
                    .setColor('#4ECDC4')
                    .addFields([
                        { name: '📅 Date', value: formatDate(dateString), inline: true },
                        { name: '🕐 Time', value: time, inline: true },
                        { name: '📍 Location', value: location, inline: true },
                        { name: '📝 Description', value: description, inline: false }
                    ])
                    .setFooter({ 
                        text: `Event ID: ${newEvent.id} | Created by ${interaction.user.tag}`,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();

                if (imagePath) {
                    embed.addFields([{ name: '🖼️ Image', value: 'Image attached successfully', inline: true }]);
                }

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error creating event:', error);
                await interaction.editReply('❌ An error occurred while creating the event. Please try again.');
            }
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('list-events')
            .setDescription('List all upcoming events')
            .addBooleanOption(option =>
                option.setName('all')
                    .setDescription('Show all events (including past ones)')
                    .setRequired(false)),

        async execute(interaction, eventManager) {
            await interaction.deferReply();

            try {
                const showAll = interaction.options.getBoolean('all') || false;
                const events = showAll ? eventManager.getEvents() : eventManager.getUpcomingEvents();

                if (events.length === 0) {
                    const embed = new EmbedBuilder()
                        .setTitle('📅 No Events Found')
                        .setDescription(showAll ? 'No events in the calendar.' : 'No upcoming events scheduled.')
                        .setColor('#FFA726');

                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setTitle(`📅 ${showAll ? 'All Events' : 'Upcoming Events'}`)
                    .setColor('#4ECDC4')
                    .setFooter({ 
                        text: `${events.length} event(s) found`,
                        iconURL: interaction.client.user.displayAvatarURL()
                    })
                    .setTimestamp();

                // Add events as fields (max 25 fields per embed)
                const maxEvents = Math.min(events.length, 25);
                
                for (let i = 0; i < maxEvents; i++) {
                    const event = events[i];
                    const eventDate = new Date(event.date);
                    const isToday = eventDate.toDateString() === new Date().toDateString();
                    const isPast = eventDate < new Date();
                    
                    let status = '';
                    if (isPast) status = '🕒 Past';
                    else if (isToday) status = '🔥 Today';
                    else status = `📅 ${getDaysUntil(event.date)} days`;

                    const fieldValue = [
                        `📝 ${event.description}`,
                        `🕐 ${event.time}`,
                        `📍 ${event.location}`,
                        `${status}`
                    ].join('\n');

                    embed.addFields([{
                        name: `${event.title}`,
                        value: fieldValue,
                        inline: true
                    }]);
                }

                if (events.length > 25) {
                    embed.setDescription(`Showing first 25 of ${events.length} events. Use filters to see specific events.`);
                }

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error listing events:', error);
                await interaction.editReply('❌ An error occurred while fetching events.');
            }
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('delete-event')
            .setDescription('Delete an event from the calendar')
            .addStringOption(option =>
                option.setName('identifier')
                    .setDescription('Event title (or part of it) or Event ID')
                    .setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

        async execute(interaction, eventManager) {
            await interaction.deferReply({ ephemeral: true });

            try {
                const identifier = interaction.options.getString('identifier');
                const events = eventManager.getEvents();
                
                // First, try to find by exact ID
                let eventToDelete = events.find(event => event.id === identifier);
                
                if (eventToDelete) {
                    // Found by ID, delete directly
                    eventManager.deleteEvent(eventToDelete.id);

                    const embed = new EmbedBuilder()
                        .setTitle('🗑️ Event Deleted')
                        .setDescription(`**${eventToDelete.title}** has been removed from the calendar`)
                        .setColor('#FF6B6B')
                        .addFields([
                            { name: '📅 Date', value: formatDate(eventToDelete.date), inline: true },
                            { name: '🕐 Time', value: eventToDelete.time || 'Not specified', inline: true }
                        ])
                        .setFooter({ 
                            text: `Deleted by ${interaction.user.tag}`,
                            iconURL: interaction.user.displayAvatarURL()
                        })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                // If not found by ID, search by title
                const searchTitle = identifier.toLowerCase();
                const matchingEvents = events.filter(event => 
                    event.title.toLowerCase().includes(searchTitle)
                );

                if (matchingEvents.length === 0) {
                    await interaction.editReply('❌ No events found matching that title or ID.');
                    return;
                }

                if (matchingEvents.length > 1) {
                    const eventList = matchingEvents.map(event => 
                        `• **${event.title}** (${formatDate(event.date)}) - ID: \`${event.id}\``
                    ).join('\n');

                    const embed = new EmbedBuilder()
                        .setTitle('🔍 Multiple Events Found')
                        .setDescription(`Multiple events match "${identifier}". Please use the specific event ID:\n\n${eventList}\n\n💡 **Tip:** Use \`/delete-event identifier:EVENT_ID\` to delete a specific event.`)
                        .setColor('#FFA726');

                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                // Delete the single matching event
                eventToDelete = matchingEvents[0];
                eventManager.deleteEvent(eventToDelete.id);

                const embed = new EmbedBuilder()
                    .setTitle('🗑️ Event Deleted')
                    .setDescription(`**${eventToDelete.title}** has been removed from the calendar`)
                    .setColor('#FF6B6B')
                    .addFields([
                        { name: '📅 Date', value: formatDate(eventToDelete.date), inline: true },
                        { name: '🕐 Time', value: eventToDelete.time, inline: true },
                        { name: '📍 Location', value: eventToDelete.location, inline: true }
                    ])
                    .setFooter({ 
                        text: `Deleted by ${interaction.user.tag}`,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error deleting event:', error);
                await interaction.editReply('❌ An error occurred while deleting the event.');
            }
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('bot-info')
            .setDescription('Display bot information and statistics'),

        async execute(interaction, eventManager) {
            const events = eventManager.getEvents();
            const upcomingEvents = eventManager.getUpcomingEvents();
            
            const embed = new EmbedBuilder()
                .setTitle('🤖 GMU AI Club Bot Information')
                .setDescription('Discord bot for automated event announcements and reminders')
                .setColor('#4ECDC4')
                .addFields([
                    { name: '📊 Statistics', value: `Total Events: ${events.length}\nUpcoming Events: ${upcomingEvents.length}`, inline: true },
                    { name: '⚙️ Features', value: '• 7-day advance announcements\n• Same-day reminders at 10:15 AM\n• Event management commands', inline: true },
                    { name: '📝 Commands', value: '• `/add-event` - Create new event\n• `/list-events` - View events\n• `/delete-event` - Remove event', inline: false }
                ])
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .setFooter({ 
                    text: 'GMU AI Club | Made with ❤️',
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('send-announcements')
            .setDescription('Manually send announcements for events (Admin only)')
            .addStringOption(option =>
                option.setName('type')
                    .setDescription('Type of announcement to send')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Advance Announcement (7-day)', value: 'advance' },
                        { name: 'Same-day Reminder (3-hour)', value: 'reminder' },
                        { name: 'Both', value: 'both' }
                    ))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

        async execute(interaction, eventManager) {
            await interaction.deferReply({ ephemeral: true });

            try {
                const announcementType = interaction.options.getString('type');
                const bot = interaction.client;
                
                // Import the announcement functions
                const { sendAdvanceAnnouncements, sendTodayReminders } = require('./announcementUtils');

                // Always use selection mode by passing the interaction
                if (announcementType === 'advance' || announcementType === 'both') {
                    await sendAdvanceAnnouncements(bot, eventManager, interaction);
                }

                if (announcementType === 'reminder' || announcementType === 'both') {
                    await sendTodayReminders(bot, eventManager, interaction);
                }

            } catch (error) {
                console.error('Error sending announcements:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply('❌ An error occurred while sending announcements.');
                } else {
                    await interaction.editReply('❌ An error occurred while sending announcements.');
                }
            }
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('edit-event')
            .setDescription('Edit an existing event (Admin only)')
            .addStringOption(option =>
                option.setName('identifier')
                    .setDescription('Event title (or part of it) or Event ID')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('title')
                    .setDescription('New event title')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('description')
                    .setDescription('New event description')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('date')
                    .setDescription('New event date (YYYY-MM-DD format)')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('time')
                    .setDescription('New event time (e.g., 2:00 PM)')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('location')
                    .setDescription('New event location')
                    .setRequired(false))
            .addAttachmentOption(option =>
                option.setName('image')
                    .setDescription('New event image/poster')
                    .setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

        async execute(interaction, eventManager) {
            await interaction.deferReply({ ephemeral: true });

            try {
                const identifier = interaction.options.getString('identifier');
                const events = eventManager.getEvents();
                
                // Find event by ID or title
                let eventToEdit = events.find(event => event.id === identifier);
                
                if (!eventToEdit) {
                    // Search by title
                    const searchTitle = identifier.toLowerCase();
                    const matchingEvents = events.filter(event => 
                        event.title.toLowerCase().includes(searchTitle)
                    );

                    if (matchingEvents.length === 0) {
                        await interaction.editReply('❌ No events found matching that title or ID.');
                        return;
                    }

                    if (matchingEvents.length > 1) {
                        const eventList = matchingEvents.map(event => 
                            `• **${event.title}** (${formatDate(event.date)}) - ID: \`${event.id}\``
                        ).join('\n');

                        const embed = new EmbedBuilder()
                            .setTitle('🔍 Multiple Events Found')
                            .setDescription(`Multiple events match "${identifier}". Please use the specific event ID:\n\n${eventList}`)
                            .setColor('#FFA726');

                        await interaction.editReply({ embeds: [embed] });
                        return;
                    }

                    eventToEdit = matchingEvents[0];
                }

                // Get new values or keep existing ones
                const updates = {};
                const newTitle = interaction.options.getString('title');
                const newDescription = interaction.options.getString('description');
                const newDate = interaction.options.getString('date');
                const newTime = interaction.options.getString('time');
                const newLocation = interaction.options.getString('location');
                const newImage = interaction.options.getAttachment('image');

                if (newTitle) updates.title = newTitle;
                if (newDescription) updates.description = newDescription;
                if (newTime) updates.time = newTime;
                if (newLocation) updates.location = newLocation;

                // Validate new date if provided
                if (newDate) {
                    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                    if (!dateRegex.test(newDate)) {
                        await interaction.editReply('❌ Invalid date format! Please use YYYY-MM-DD format.');
                        return;
                    }

                    const eventDate = new Date(newDate);
                    if (isNaN(eventDate.getTime())) {
                        await interaction.editReply('❌ Invalid date! Please check your date format.');
                        return;
                    }

                    // Check if date is in the past
                    const today = new Date();
                    const todayDateString = today.toISOString().split('T')[0];
                    
                    if (newDate < todayDateString) {
                        await interaction.editReply('❌ Cannot set events to past dates!');
                        return;
                    }

                    updates.date = newDate;
                }

                // Handle image upload
                if (newImage) {
                    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                    if (!allowedTypes.includes(newImage.contentType)) {
                        await interaction.editReply('❌ Invalid image format! Please use JPG, PNG, GIF, or WebP.');
                        return;
                    }

                    try {
                        const response = await fetch(newImage.url);
                        const buffer = Buffer.from(await response.arrayBuffer());
                        
                        const fileName = `${Date.now()}_${newImage.name}`;
                        const imagePath = eventManager.saveEventImage(buffer, fileName);
                        updates.imagePath = imagePath;
                    } catch (error) {
                        console.error('Error saving image:', error);
                        await interaction.editReply('❌ Error saving image. Other changes will be applied without the image.');
                    }
                }

                // Apply updates
                const updatedEvent = eventManager.updateEvent(eventToEdit.id, updates);

                // Create success embed
                const embed = new EmbedBuilder()
                    .setTitle('✅ Event Updated Successfully!')
                    .setDescription(`**${updatedEvent.title}** has been updated`)
                    .setColor('#4ECDC4')
                    .addFields([
                        { name: '📅 Date', value: formatDate(updatedEvent.date), inline: true },
                        { name: '🕐 Time', value: updatedEvent.time, inline: true },
                        { name: '📍 Location', value: updatedEvent.location, inline: true },
                        { name: '📝 Description', value: updatedEvent.description, inline: false }
                    ])
                    .setFooter({ 
                        text: `Event ID: ${updatedEvent.id} | Updated by ${interaction.user.tag}`,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();

                if (updates.imagePath) {
                    embed.addFields([{ name: '🖼️ Image', value: 'Image updated successfully', inline: true }]);
                }

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error editing event:', error);
                await interaction.editReply('❌ An error occurred while editing the event. Please try again.');
            }
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('sync-events')
            .setDescription('Sync events from Google Sheets (Admin only)')
            .addBooleanOption(option =>
                option.setName('preview')
                    .setDescription('Preview events without importing them')
                    .setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

        async execute(interaction, eventManager) {
            await interaction.deferReply({ ephemeral: true });

            try {
                const GoogleSheetsService = require('./googleSheetsService');
                const sheetsService = new GoogleSheetsService();
                const isPreview = interaction.options.getBoolean('preview') ?? false;

                if (!sheetsService.isConfigured) {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ Google Sheets Not Configured')
                        .setDescription('Google Sheets integration is not set up. Please check your environment variables:\n\n• `GOOGLE_SHEETS_ID`\n• `GOOGLE_SERVICE_ACCOUNT_EMAIL`\n• `GOOGLE_PRIVATE_KEY`')
                        .setColor('#FF6B6B');
                    
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                // Test connection first
                const connectionTest = await sheetsService.testConnection();
                if (!connectionTest.success) {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ Connection Failed')
                        .setDescription(`Could not connect to Google Sheets:\n\`\`\`${connectionTest.error}\`\`\``)
                        .setColor('#FF6B6B');
                    
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                // Fetch events from sheets
                const sheetEvents = await sheetsService.getEvents();
                
                if (sheetEvents.length === 0) {
                    const embed = new EmbedBuilder()
                        .setTitle('📄 No Events Found')
                        .setDescription('No events were found in the Google Sheet or all events had parsing errors.')
                        .setColor('#FFA726');
                    
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                if (isPreview) {
                    // Show preview of events
                    const embed = new EmbedBuilder()
                        .setTitle(`📊 Preview: ${sheetEvents.length} Events Found`)
                        .setDescription(`Connected to: **${connectionTest.title}**\n\nEvents that would be imported:`)
                        .setColor('#4ECDC4')
                        .setFooter({ 
                            text: `Run without preview flag to import • Found ${sheetEvents.length} events`,
                            iconURL: interaction.client.user.displayAvatarURL()
                        });

                    // Add up to 10 events as fields
                    const previewEvents = sheetEvents.slice(0, 10);
                    previewEvents.forEach(event => {
                        embed.addFields([{
                            name: event.title,
                            value: `📅 ${formatDate(event.date)}\n🕐 ${event.time}\n📍 ${event.location}`,
                            inline: true
                        }]);
                    });

                    if (sheetEvents.length > 10) {
                        embed.addFields([{
                            name: `... and ${sheetEvents.length - 10} more`,
                            value: 'Use `/sync-events` without preview to import all events',
                            inline: false
                        }]);
                    }

                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                // Import events
                let importedCount = 0;
                let skippedCount = 0;
                let errorCount = 0;
                const results = [];

                for (const sheetEvent of sheetEvents) {
                    try {
                        // Check if event already exists (by title and date)
                        const existingEvents = eventManager.getEvents();
                        const duplicate = existingEvents.find(existing => 
                            existing.title.toLowerCase() === sheetEvent.title.toLowerCase() && 
                            existing.date === sheetEvent.date
                        );

                        if (duplicate) {
                            // Smart update: only update fields that are empty or from Google Sheets
                            // Preserve manually added data like images and custom descriptions
                            const updates = {};
                            let hasUpdates = false;

                            // Only update if the existing event was from Google Sheets or has no custom data
                            if (duplicate.source === 'google_sheets') {
                                // Update basic info from Google Sheets
                                if (duplicate.description !== sheetEvent.description) {
                                    updates.description = sheetEvent.description;
                                    hasUpdates = true;
                                }
                                if (duplicate.time !== sheetEvent.time) {
                                    updates.time = sheetEvent.time;
                                    hasUpdates = true;
                                }
                                if (duplicate.location !== sheetEvent.location) {
                                    updates.location = sheetEvent.location;
                                    hasUpdates = true;
                                }
                            }

                            if (hasUpdates) {
                                eventManager.updateEvent(duplicate.id, updates);
                                results.push(`🔄 Updated: ${sheetEvent.title} (from Google Sheets)`);
                                importedCount++;
                            } else {
                                results.push(`⏭️ Skipped: ${sheetEvent.title} (already exists, preserving manual changes)`);
                                skippedCount++;
                            }
                            continue;
                        }

                        // Add event to manager
                        const eventData = {
                            title: sheetEvent.title,
                            description: sheetEvent.description,
                            date: sheetEvent.date,
                            time: sheetEvent.time,
                            location: sheetEvent.location,
                            createdBy: interaction.user.id,
                            source: 'google_sheets',
                            rowNumber: sheetEvent.rowNumber
                        };

                        eventManager.addEvent(eventData);
                        importedCount++;
                        results.push(`✅ Imported: ${sheetEvent.title}`);

                    } catch (error) {
                        errorCount++;
                        results.push(`❌ Error: ${sheetEvent.title} - ${error.message}`);
                        console.error(`Error importing event "${sheetEvent.title}":`, error);
                    }
                }

                // Create results embed
                const embed = new EmbedBuilder()
                    .setTitle('📊 Google Sheets Sync Complete')
                    .setDescription(`**Results:**\n✅ Imported: ${importedCount}\n⏭️ Skipped: ${skippedCount}\n❌ Errors: ${errorCount}`)
                    .setColor(importedCount > 0 ? '#4ECDC4' : '#FFA726')
                    .setFooter({ 
                        text: `Synced from: ${connectionTest.title}`,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();

                // Add detailed results (up to 20 items)
                if (results.length > 0) {
                    const detailedResults = results.slice(0, 20).join('\n');
                    embed.addFields([{
                        name: 'Detailed Results',
                        value: detailedResults.length > 1000 ? 
                            detailedResults.substring(0, 997) + '...' : 
                            detailedResults,
                        inline: false
                    }]);

                    if (results.length > 20) {
                        embed.addFields([{
                            name: `... and ${results.length - 20} more`,
                            value: 'Check console logs for full details',
                            inline: false
                        }]);
                    }
                }

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error in sync-events command:', error);
                const embed = new EmbedBuilder()
                    .setTitle('❌ Sync Failed')
                    .setDescription(`An error occurred during sync:\n\`\`\`${error.message}\`\`\``)
                    .setColor('#FF6B6B');
                
                await interaction.editReply({ embeds: [embed] });
            }
        }
    }
];

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

module.exports = commands;
