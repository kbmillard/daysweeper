# Google Maps Geocoding Setup

This application uses Google Maps Geocoding API to accurately geocode company locations.

## Setup Instructions

### 1. Get a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Geocoding API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Geocoding API"
   - Click "Enable"
4. Create an API key:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the API key

### 2. Add API Key to Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings > Environment Variables
3. Add a new variable:
   - **Name**: `GOOGLE_MAPS_API_KEY`
   - **Value**: Your Google Maps API key
   - **Environments**: Production, Preview, Development

### 3. Secure Your API Key (Recommended)

1. In Google Cloud Console, go to your API key settings
2. Under "API restrictions", select "Restrict key"
3. Choose "Geocoding API" only
4. Under "Application restrictions", you can:
   - Add your domain (e.g., `daysweeper.recyclicbravery.com`)
   - Or use IP address restrictions

## Usage

### Bulk Geocoding

1. Navigate to **Dashboard > Geocoding**
2. You'll see:
   - Total locations
   - How many are geocoded
   - How many need geocoding
3. Click **"Start Bulk Geocoding"** to geocode all locations at once

### Features

- **Accurate Coordinates**: Uses Google Maps for precise lat/long
- **Formatted Addresses**: Gets standardized address format
- **Address Components**: Stores detailed address breakdown
- **Rate Limiting**: Built-in delays to respect API limits
- **Error Handling**: Shows which addresses failed and why

### API Endpoints

- `POST /api/geocode/google` - Geocode a single address
- `POST /api/geocode/bulk` - Geocode up to 100 locations at once

## Pricing

Google Maps Geocoding API pricing (as of 2024):
- **$5 per 1,000 requests**
- **$200 free credit per month** (covers ~40,000 requests)

For most use cases, the free tier is sufficient.

## Troubleshooting

### "Google Maps API key not configured"
- Make sure you've added `GOOGLE_MAPS_API_KEY` to Vercel environment variables
- Redeploy your application after adding the variable

### Geocoding fails for some addresses
- Check if the address is complete and valid
- Try simplifying the address (remove suite numbers, etc.)
- Check Google Cloud Console for API errors

### Rate limit errors
- The bulk geocoding has built-in 100ms delays
- If you hit limits, wait a few minutes and try again
- Consider upgrading your Google Cloud plan for higher limits