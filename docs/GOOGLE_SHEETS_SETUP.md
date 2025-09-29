# Google Sheets API Setup Guide

This guide will help you set up Google Sheets API integration for your Discord bot.

## Step 1: Enable Google Sheets API

1. **Go to Google Cloud Console**
   - Visit [Google Cloud Console](https://console.cloud.google.com/)
   - Sign in with your Google account

2. **Create or Select Project**
   - Click on the project dropdown at the top
   - Either select an existing project or click "New Project"
   - If creating new: Enter project name (e.g., "GMU AI Club Bot") and click "Create"

3. **Enable Google Sheets API**
   - In the left sidebar, go to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click on "Google Sheets API" and click "Enable"

## Step 2: Create Service Account

1. **Go to Credentials**
   - In the left sidebar, go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"

2. **Configure Service Account**
   - Service account name: `gmu-ai-club-bot`
   - Service account ID: (auto-generated)
   - Description: `Discord bot service account for Google Sheets`
   - Click "Create and Continue"

3. **Skip Role Assignment**
   - Click "Continue" (we'll handle permissions at the sheet level)
   - Click "Done"

## Step 3: Generate Private Key

1. **Find Your Service Account**
   - In the Credentials page, find your service account under "Service Accounts"
   - Click on the service account email

2. **Create Key**
   - Go to the "Keys" tab
   - Click "Add Key" → "Create New Key"
   - Select "JSON" format
   - Click "Create"
   - A JSON file will download - **keep this safe!**

## Step 4: Share Your Google Sheet

1. **Open Your Google Sheet**
   - Go to your "AI Club Events & Projects" sheet

2. **Share with Service Account**
   - Click the "Share" button (top right)
   - In the email field, paste your service account email (from the JSON file: `client_email`)
   - Set permission to "Viewer"
   - Uncheck "Notify people"
   - Click "Share"

## Step 5: Get Sheet ID

1. **Copy Sheet ID from URL**
   - Your sheet URL looks like: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
   - Copy the `SHEET_ID_HERE` part

## Step 6: Configure Environment Variables

1. **Open the downloaded JSON file** and find these values:
   - `client_email` 
   - `private_key`

2. **Add to your `.env` file:**
   ```env
   # Google Sheets Configuration
   GOOGLE_SHEETS_ID=your_sheet_id_here
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project-name.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
   ```

   **Important Notes:**
   - Replace `your_sheet_id_here` with your actual sheet ID
   - Replace the email with your service account email from the JSON
   - Replace the private key with your actual private key from the JSON
   - Keep the quotes around the private key
   - The `\n` characters in the private key should stay as `\n` (literal backslash-n)

## Step 7: Install Dependencies

Run this command in your bot directory:
```bash
npm install
```

## Step 8: Test the Integration

1. **Start your bot**
2. **Test preview:**
   ```
   /sync-events preview:True
   ```
   This will show you what events would be imported without actually importing them.

3. **Import events:**
   ```
   /sync-events
   ```
   This will import all events from your Google Sheet.

## How It Works

### Sheet Structure Expected:
- **Column A:** Event Name
- **Column B:** Event Speaker (optional)
- **Column C:** Date & Time (e.g., "October 2nd, 2025 4 - 5pm")
- **Column D:** Where @ (Location)
- **Column E:** Description

### Features:
- ✅ **Smart date parsing** - handles your date format automatically
- ✅ **Speaker integration** - adds speaker info to descriptions
- ✅ **Duplicate detection** - won't import the same event twice
- ✅ **Preview mode** - see what will be imported before doing it
- ✅ **Error handling** - skips problematic rows and reports issues

### Commands:
- `/sync-events preview:True` - Preview events without importing
- `/sync-events` - Import all events from the sheet

## Troubleshooting

### Common Issues:

1. **"Google Sheets Not Configured" Error**
   - Check that all 3 environment variables are set correctly
   - Make sure there are no extra spaces in the values

2. **"Connection Failed" Error**
   - Verify the service account email is correct
   - Make sure the private key is properly formatted with `\n` characters
   - Check that the Google Sheets API is enabled in your project

3. **"No Events Found" Error**
   - Make sure your sheet has data starting from row 2 (row 1 should be headers)
   - Check that columns A (Event Name) and C (Date & Time) have data
   - Verify the sheet ID is correct

4. **Date Parsing Errors**
   - The bot expects dates like "October 2nd, 2025 4 - 5pm"
   - Make sure dates include the year
   - Times can be ranges (4 - 5pm) or single times (4pm)

### Getting Help:
If you encounter issues, check the bot's console logs for detailed error messages. The logs will show exactly which rows failed to parse and why.

## Security Notes

- **Keep your JSON key file secure** - don't commit it to version control
- **The service account only has read access** to your specific sheet
- **Private key should be kept in environment variables** only
- **Never share your private key** publicly

That's it! Your bot should now be able to sync events directly from your Google Sheet. 🎉
