const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin matches our allowed patterns
    const isAllowed = config.CORS_ORIGINS.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        // Handle wildcard patterns like "https://*.vercel.app"
        const pattern = allowedOrigin.replace(/\*/g, '.*');
        return new RegExp(pattern).test(origin);
      }
      return allowedOrigin === origin;
    });
    
    callback(null, isAllowed);
  },
  credentials: true
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// In-memory storage for viewer sessions
const viewerSessions = new Map();
let totalViewerCount = 0;

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
  
  totalViewerCount = viewerSessions.size;
  
  if (config.DEBUG && removedCount > 0) {
    console.log(`[${new Date().toISOString()}] Cleaned up ${removedCount} expired sessions. Active: ${totalViewerCount}`);
  }
  
  return removedCount;
}

function logRequest(req, action, details = '') {
  if (config.DEBUG) {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress;
    console.log(`[${timestamp}] ${action} - IP: ${ip} ${details}`);
  }
}

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: getCurrentTimestamp(),
    active_sessions: viewerSessions.size,
    uptime: process.uptime()
  });
});

// Register/update viewer session
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
    
    // Update or create session
    const sessionData = {
      sessionId: session_id,
      lastHeartbeat: now,
      firstSeen: viewerSessions.has(session_id) ? viewerSessions.get(session_id).firstSeen : now,
      pageUrl: page_url || '',
      userAgent: (user_agent || '').substring(0, 100), // Limit for privacy/storage
      ipAddress: req.ip || req.connection.remoteAddress
    };
    
    const isNewSession = !viewerSessions.has(session_id);
    viewerSessions.set(session_id, sessionData);
    
    // Clean up expired sessions periodically
    if (Math.random() < 0.1) { // 10% chance on each request
      cleanupExpiredSessions();
    }
    
    totalViewerCount = viewerSessions.size;
    
    // Prevent memory bloat
    if (totalViewerCount > config.MAX_SESSIONS) {
      // Remove oldest sessions
      const sortedSessions = Array.from(viewerSessions.entries())
        .sort((a, b) => a[1].lastHeartbeat - b[1].lastHeartbeat);
      
      const toRemove = totalViewerCount - config.MAX_SESSIONS + 100; // Remove extra for buffer
      for (let i = 0; i < toRemove; i++) {
        viewerSessions.delete(sortedSessions[i][0]);
      }
      
      totalViewerCount = viewerSessions.size;
    }
    
    logRequest(req, 'VIEWER_HEARTBEAT', `Session: ${session_id.substring(0, 20)}... ${isNewSession ? '(NEW)' : '(UPDATE)'} - Total: ${totalViewerCount}`);
    
    res.json({
      live_viewers: totalViewerCount,
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

// Remove viewer session
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
    totalViewerCount = viewerSessions.size;
    
    logRequest(req, 'VIEWER_LEAVE', `Session: ${session_id.substring(0, 20)}... ${wasRemoved ? '(REMOVED)' : '(NOT_FOUND)'} - Total: ${totalViewerCount}`);
    
    res.json({
      status: wasRemoved ? 'removed' : 'not_found',
      live_viewers: totalViewerCount,
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

// Get current viewer count (optional monitoring endpoint)
app.get('/api/viewers/count', (req, res) => {
  try {
    cleanupExpiredSessions(); // Always cleanup on count requests
    
    logRequest(req, 'VIEWER_COUNT', `Total: ${totalViewerCount}`);
    
    res.json({
      live_viewers: totalViewerCount,
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

// Debug endpoint (only in development)
if (config.DEBUG) {
  app.get('/api/debug/sessions', (req, res) => {
    const sessions = Array.from(viewerSessions.entries()).map(([id, data]) => ({
      sessionId: id.substring(0, 20) + '...',
      lastHeartbeat: new Date(data.lastHeartbeat).toISOString(),
      firstSeen: new Date(data.firstSeen).toISOString(),
      pageUrl: data.pageUrl,
      userAgent: data.userAgent.substring(0, 50) + '...',
      isExpired: isSessionExpired(data)
    }));
    
    res.json({
      total_sessions: viewerSessions.size,
      sessions: sessions,
      config: {
        session_timeout: config.SESSION_TIMEOUT,
        cleanup_interval: config.CLEANUP_INTERVAL,
        max_sessions: config.MAX_SESSIONS
      }
    });
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    status: 'error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    status: 'error',
    available_endpoints: [
      'GET /api/health',
      'POST /api/viewers',
      'POST /api/viewers/leave',
      'GET /api/viewers/count'
    ]
  });
});

// Periodic cleanup
setInterval(cleanupExpiredSessions, config.CLEANUP_INTERVAL);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const port = config.PORT;
app.listen(port, () => {
  console.log(`🚀 Live Viewer API running on port ${port}`);
  console.log(`📊 Debug mode: ${config.DEBUG ? 'ENABLED' : 'DISABLED'}`);
  console.log(`⏱️  Session timeout: ${config.SESSION_TIMEOUT / 1000}s`);
  console.log(`🧹 Cleanup interval: ${config.CLEANUP_INTERVAL / 1000}s`);
  
  if (config.DEBUG) {
    console.log(`🔍 Debug endpoint: http://localhost:${port}/api/debug/sessions`);
  }
});

module.exports = app;
