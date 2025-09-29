const { google } = require('googleapis');
require('dotenv').config();

class GoogleSheetsService {
    constructor() {
        this.sheetsId = process.env.GOOGLE_SHEETS_ID;
        this.serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        this.privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        
        if (!this.sheetsId || !this.serviceAccountEmail || !this.privateKey) {
            console.warn('⚠️ Google Sheets credentials not configured. Sheet sync will be disabled.');
            this.isConfigured = false;
            return;
        }
        
        this.isConfigured = true;
        this.initializeAuth();
    }

    initializeAuth() {
        try {
            this.auth = new google.auth.JWT(
                this.serviceAccountEmail,
                null,
                this.privateKey,
                ['https://www.googleapis.com/auth/spreadsheets.readonly']
            );
            
            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            console.log('✅ Google Sheets service initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing Google Sheets auth:', error);
            this.isConfigured = false;
        }
    }

    async getEvents() {
        if (!this.isConfigured) {
            throw new Error('Google Sheets service is not properly configured');
        }

        try {
            console.log('📊 Fetching events from Google Sheets...');
            
            // Read the sheet data (assuming data starts from row 2, row 1 is headers)
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.sheetsId,
                range: 'A2:E100', // Adjust range as needed
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                console.log('📄 No data found in Google Sheets');
                return [];
            }

            console.log(`📋 Found ${rows.length} rows in Google Sheets`);
            
            const events = [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                
                // Skip empty rows or rows without essential data
                if (!row[0] || !row[2]) continue; // Need at least Event Name and Date & Time
                
                try {
                    const event = this.parseEventRow(row, i + 2); // +2 because we start from row 2
                    if (event) {
                        events.push(event);
                    }
                } catch (error) {
                    console.warn(`⚠️ Error parsing row ${i + 2}:`, error.message);
                    continue;
                }
            }

            console.log(`✅ Successfully parsed ${events.length} events from Google Sheets`);
            return events;

        } catch (error) {
            console.error('❌ Error fetching events from Google Sheets:', error);
            throw error;
        }
    }

    parseEventRow(row, rowNumber) {
        const [eventName, eventSpeaker, dateTime, location, description] = row;

        // Parse the date and time from column C
        const { date, time } = this.parseDateTimeString(dateTime);
        if (!date) {
            throw new Error(`Invalid date format in row ${rowNumber}: "${dateTime}"`);
        }

        // Create event object
        const event = {
            title: eventName.trim(),
            speaker: eventSpeaker ? eventSpeaker.trim() : null,
            description: description ? description.trim() : eventName.trim(),
            date: date,
            time: time || 'TBA',
            location: location ? location.trim() : 'TBA',
            source: 'google_sheets',
            rowNumber: rowNumber
        };

        // Enhance description with speaker info if available
        if (event.speaker && event.speaker !== '') {
            event.description = `Speaker: ${event.speaker}\n\n${event.description}`;
        }

        return event;
    }

    parseDateTimeString(dateTimeStr) {
        if (!dateTimeStr) return { date: null, time: null };

        try {
            // Handle multi-line format from your sheet
            // Format: "September 22nd, 2025\n7 - 8:30pm"
            
            const str = dateTimeStr.trim();
            
            // Split by newlines to handle multi-line format
            const lines = str.split('\n').map(line => line.trim()).filter(line => line);
            
            let dateStr = '';
            let timeStr = '';
            
            if (lines.length >= 2) {
                // Multi-line format: first line is date, second line is time
                dateStr = lines[0];
                timeStr = lines[1];
            } else if (lines.length === 1) {
                // Single line format: try to extract both
                const singleLine = lines[0];
                const dateMatch = singleLine.match(/^([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?, \d{4})/);
                if (dateMatch) {
                    dateStr = dateMatch[1];
                    timeStr = singleLine.replace(dateMatch[1], '').trim();
                } else {
                    dateStr = singleLine;
                }
            }
            
            if (!dateStr) {
                throw new Error(`Could not extract date from: "${str}"`);
            }
            
            // Remove ordinal suffixes (st, nd, rd, th) for JavaScript Date parsing
            const cleanDateStr = dateStr.replace(/(\d+)(st|nd|rd|th)/g, '$1');
            
            // Parse the date
            const parsedDate = new Date(cleanDateStr);
            if (isNaN(parsedDate.getTime())) {
                throw new Error(`Invalid date: "${dateStr}" (cleaned: "${cleanDateStr}")`);
            }
            
            // Format as YYYY-MM-DD
            const formattedDate = parsedDate.toISOString().split('T')[0];
            
            // Extract time if available
            let time = null;
            if (timeStr) {
                const timeMatch = timeStr.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
                if (timeMatch) {
                    // Use start time
                    time = this.normalizeTime(timeMatch[1]);
                } else {
                    // Try to find a single time
                    const singleTimeMatch = timeStr.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
                    if (singleTimeMatch) {
                        time = this.normalizeTime(singleTimeMatch[1]);
                    }
                }
            }
            
            return { date: formattedDate, time: time };
            
        } catch (error) {
            console.warn(`⚠️ Date parsing error for "${dateTimeStr}":`, error.message);
            return { date: null, time: null };
        }
    }

    normalizeTime(timeStr) {
        if (!timeStr) return null;
        
        // Clean up the time string
        let cleaned = timeStr.trim().toLowerCase();
        
        // Add :00 if no minutes specified
        if (!/:\d{2}/.test(cleaned)) {
            cleaned = cleaned.replace(/(\d+)/, '$1:00');
        }
        
        // Ensure proper AM/PM format
        if (!/am|pm/.test(cleaned)) {
            // Assume PM for times 1-11, AM for 12
            const hour = parseInt(cleaned);
            if (hour >= 1 && hour <= 11) {
                cleaned += 'pm';
            } else if (hour === 12) {
                cleaned += 'pm';
            }
        }
        
        // Format properly
        cleaned = cleaned.replace(/(\d{1,2}:\d{2})\s*(am|pm)/, '$1 $2');
        
        // Convert to proper case
        return cleaned.replace(/(am|pm)/, (match) => match.toUpperCase());
    }

    async testConnection() {
        if (!this.isConfigured) {
            return { success: false, error: 'Google Sheets service is not configured' };
        }

        try {
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.sheetsId,
            });
            
            return { 
                success: true, 
                title: response.data.properties.title,
                sheets: response.data.sheets.map(sheet => sheet.properties.title)
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = GoogleSheetsService;
