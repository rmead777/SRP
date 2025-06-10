const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Configuration
const config = {
  SESSION_TIMEOUT: 60 * 1000, // 60 seconds
  CLEANUP_INTERVAL: 30 * 1000, // 30 seconds
  MAX_SESSIONS: 10000,
  DEBUG: process.env.NODE_ENV !== 'production'
};

// Security middleware
app.use(helmet());

// CORS configuration - allow all origins for simplicity in serverless
app.use(cors({
  origin: true,
  credentials: true
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// In-memory storage for viewer sessions
const viewerSessions = new Map();

// Utility functions
function getCurrentTimestamp() {
  return Date.now();
}

function isSessionExpired(session) {
  const now = getCurrentTimestamp();
  return (now - session.lastHeartbeat) > config.SESSION_TIMEOUT;
}

function cleanupExpiredSessions() {
  const now = getCurrentTimestamp();
  let removedCount = 0;
  
  for (const [sessionId, session] of viewerSessions.entries()) {
    if (isSessionExpired(session)) {
      viewerSessions.delete(sessionId);
      removedCount++;
    }
  }
  
  if (config.DEBUG && removedCount > 0) {
    console.log(`Cleaned up ${removedCount} expired sessions. Active: ${viewerSessions.size}`);
  }
  
  return removedCount;
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: getCurrentTimestamp(),
    active_sessions: viewerSessions.size,
    uptime: process.uptime()
  });
});

app.post('/api/viewers', (req, res) => {
  try {
    const { session_id, timestamp, page_url, user_agent } = req.body;
    
    if (!session_id) {
      return res.status(400).json({
        error: 'Missing required field: session_id',
        status: 'error'
      });
    }
    
    const now = getCurrentTimestamp();
    
    const sessionData = {
      sessionId: session_id,
      lastHeartbeat: now,
      firstSeen: viewerSessions.has(session_id) ? viewerSessions.get(session_id).firstSeen : now,
      pageUrl: page_url || '',
      userAgent: (user_agent || '').substring(0, 100)
    };
    
    const isNewSession = !viewerSessions.has(session_id);
    viewerSessions.set(session_id, sessionData);
    
    // Clean up expired sessions periodically
    if (Math.random() < 0.1) {
      cleanupExpiredSessions();
    }
    
    const totalViewerCount = viewerSessions.size;
    
    // Prevent memory bloat
    if (totalViewerCount > config.MAX_SESSIONS) {
      const sortedSessions = Array.from(viewerSessions.entries())
        .sort((a, b) => a[1].lastHeartbeat - b[1].lastHeartbeat);
      
      const toRemove = totalViewerCount - config.MAX_SESSIONS + 100;
      for (let i = 0; i < toRemove; i++) {
        viewerSessions.delete(sortedSessions[i][0]);
      }
    }
    
    res.json({
      live_viewers: viewerSessions.size,
      status: 'active',
      session_id: session_id,
      is_new_session: isNewSession
    });
    
  } catch (error) {
    console.error('Error in POST /api/viewers:', error);
    res.status(500).json({
      error: 'Internal server error',
      status: 'error'
    });
  }
});

app.post('/api/viewers/leave', (req, res) => {
  try {
    const { session_id } = req.body;
    
    if (!session_id) {
      return res.status(400).json({
        error: 'Missing required field: session_id',
        status: 'error'
      });
    }
    
    const wasRemoved = viewerSessions.delete(session_id);
    
    res.json({
      status: wasRemoved ? 'removed' : 'not_found',
      live_viewers: viewerSessions.size,
      session_id: session_id
    });
    
  } catch (error) {
    console.error('Error in POST /api/viewers/leave:', error);
    res.status(500).json({
      error: 'Internal server error',
      status: 'error'
    });
  }
});

app.get('/api/viewers/count', (req, res) => {
  try {
    cleanupExpiredSessions();
    
    res.json({
      live_viewers: viewerSessions.size,
      active_sessions: viewerSessions.size,
      timestamp: getCurrentTimestamp()
    });
    
  } catch (error) {
    console.error('Error in GET /api/viewers/count:', error);
    res.status(500).json({
      error: 'Internal server error',
      status: 'error'
    });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    status: 'error'
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    status: 'error'
  });
});

// For Vercel, we need to export the app
module.exports = app;
