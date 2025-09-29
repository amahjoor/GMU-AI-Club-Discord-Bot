const fs = require('fs');
const path = require('path');

class EventManager {
    constructor() {
        this.eventsFile = path.join(__dirname, 'events.json');
        this.imagesDir = path.join(__dirname, 'images');
        this.ensureFilesExist();
    }

    ensureFilesExist() {
        // Create events.json if it doesn't exist
        if (!fs.existsSync(this.eventsFile)) {
            fs.writeFileSync(this.eventsFile, JSON.stringify([], null, 2));
        }

        // Create images directory if it doesn't exist
        if (!fs.existsSync(this.imagesDir)) {
            fs.mkdirSync(this.imagesDir, { recursive: true });
        }
    }

    loadEvents() {
        try {
            const data = fs.readFileSync(this.eventsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading events:', error);
            return [];
        }
    }

    saveEvents(events) {
        try {
            fs.writeFileSync(this.eventsFile, JSON.stringify(events, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving events:', error);
            return false;
        }
    }

    addEvent(eventData) {
        const events = this.loadEvents();
        
        const newEvent = {
            id: this.generateId(),
            title: eventData.title,
            description: eventData.description,
            date: eventData.date,
            time: eventData.time || null,
            location: eventData.location || null,
            imagePath: eventData.imagePath || null,
            announcementSent: false,
            reminderSent: false,
            createdAt: new Date().toISOString(),
            createdBy: eventData.createdBy
        };

        events.push(newEvent);
        
        if (this.saveEvents(events)) {
            console.log(`✅ Event added: ${newEvent.title}`);
            return newEvent;
        } else {
            throw new Error('Failed to save event');
        }
    }

    getEvents() {
        return this.loadEvents().sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    getUpcomingEvents() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return this.loadEvents()
            .filter(event => new Date(event.date) >= today)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    getEventsForDate(targetDate) {
        const dateString = targetDate.toISOString().split('T')[0];
        
        return this.loadEvents().filter(event => {
            const eventDate = new Date(event.date).toISOString().split('T')[0];
            return eventDate === dateString;
        });
    }

    getEventById(id) {
        const events = this.loadEvents();
        return events.find(event => event.id === id);
    }

    updateEvent(id, updates) {
        const events = this.loadEvents();
        const eventIndex = events.findIndex(event => event.id === id);
        
        if (eventIndex === -1) {
            throw new Error('Event not found');
        }

        events[eventIndex] = { ...events[eventIndex], ...updates };
        
        if (this.saveEvents(events)) {
            console.log(`✅ Event updated: ${events[eventIndex].title}`);
            return events[eventIndex];
        } else {
            throw new Error('Failed to update event');
        }
    }

    deleteEvent(id) {
        const events = this.loadEvents();
        const eventIndex = events.findIndex(event => event.id === id);
        
        if (eventIndex === -1) {
            throw new Error('Event not found');
        }

        const deletedEvent = events[eventIndex];
        
        // Delete associated image file if it exists
        if (deletedEvent.imagePath && fs.existsSync(deletedEvent.imagePath)) {
            try {
                fs.unlinkSync(deletedEvent.imagePath);
                console.log(`🗑️ Deleted image: ${deletedEvent.imagePath}`);
            } catch (error) {
                console.error('Error deleting image file:', error);
            }
        }

        events.splice(eventIndex, 1);
        
        if (this.saveEvents(events)) {
            console.log(`✅ Event deleted: ${deletedEvent.title}`);
            return deletedEvent;
        } else {
            throw new Error('Failed to delete event');
        }
    }

    markAnnouncementSent(id) {
        return this.updateEvent(id, { announcementSent: true });
    }

    markReminderSent(id) {
        return this.updateEvent(id, { reminderSent: true });
    }

    saveEventImage(buffer, fileName) {
        try {
            const imagePath = path.join(this.imagesDir, fileName);
            fs.writeFileSync(imagePath, buffer);
            console.log(`✅ Image saved: ${imagePath}`);
            return imagePath;
        } catch (error) {
            console.error('Error saving image:', error);
            throw error;
        }
    }

    getImagePath(fileName) {
        return path.join(this.imagesDir, fileName);
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Cleanup old events (optional - run periodically)
    cleanupOldEvents(daysOld = 30) {
        const events = this.loadEvents();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        const activeEvents = events.filter(event => {
            const eventDate = new Date(event.date);
            if (eventDate < cutoffDate) {
                // Delete associated image
                if (event.imagePath && fs.existsSync(event.imagePath)) {
                    try {
                        fs.unlinkSync(event.imagePath);
                    } catch (error) {
                        console.error('Error deleting old image:', error);
                    }
                }
                return false;
            }
            return true;
        });

        if (activeEvents.length !== events.length) {
            this.saveEvents(activeEvents);
            console.log(`🧹 Cleaned up ${events.length - activeEvents.length} old events`);
        }
    }
}

module.exports = EventManager;
