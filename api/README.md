# Real-Time Viewer Count Backend API

A simple Node.js/Express backend to track live viewer counts across all users in real-time.

## Quick Setup

### Option 1: Deploy to Vercel (Recommended)
1. Copy this entire `api/` folder to your project root
2. Run `npm install` in your project root
3. Deploy to Vercel - the API endpoints will be automatically available

### Option 2: Run Locally
```bash
cd api
npm install
npm start
```

## API Endpoints

### POST /api/viewers
Register a viewer session and get current live count

**Request:**
```json
{
  "session_id": "viewer_123_abc",
  "timestamp": 1733875234567,
  "page_url": "https://yoursite.com",
  "user_agent": "Mozilla/5.0..."
}
```

**Response:**
```json
{
  "live_viewers": 187,
  "status": "active",
  "session_id": "viewer_123_abc"
}
```

### POST /api/viewers/leave
Remove a viewer session

**Request:**
```json
{
  "session_id": "viewer_123_abc",
  "timestamp": 1733875234567
}
```

**Response:**
```json
{
  "status": "removed",
  "live_viewers": 186
}
```

### GET /api/viewers/count
Get current viewer count (optional endpoint for monitoring)

**Response:**
```json
{
  "live_viewers": 187,
  "active_sessions": 187
}
```

## How It Works

1. **Session Tracking**: Each visitor gets a unique session ID
2. **Active Detection**: Sessions expire after 60 seconds without heartbeat
3. **Real-time Updates**: All users see the same live count
4. **Automatic Cleanup**: Expired sessions are automatically removed
5. **Memory Efficient**: Uses in-memory storage with periodic cleanup

## Configuration

Edit `config.js` to customize:
- Session timeout duration
- Cleanup interval
- CORS settings
- Debug mode

## Integration

Update your frontend `VIEWER_API_URL` to point to your deployed API:
```javascript
const VIEWER_API_URL = 'https://your-domain.vercel.app/api';
```
