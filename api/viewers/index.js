// In-memory storage for viewer sessions
const viewerSessions = new Map();

// Configuration
const SESSION_TIMEOUT = 60 * 1000; // 60 seconds
const MAX_SESSIONS = 10000;

function getCurrentTimestamp() {
  return Date.now();
}

function isSessionExpired(session) {
  const now = getCurrentTimestamp();
  return (now - session.lastHeartbeat) > SESSION_TIMEOUT;
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
  
  return removedCount;
}

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method === 'POST') {
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
      
      // Clean up expired sessions
      if (Math.random() < 0.1) {
        cleanupExpiredSessions();
      }
      
      const totalViewerCount = viewerSessions.size;
      
      // Prevent memory bloat
      if (totalViewerCount > MAX_SESSIONS) {
        const sortedSessions = Array.from(viewerSessions.entries())
          .sort((a, b) => a[1].lastHeartbeat - b[1].lastHeartbeat);
        
        const toRemove = totalViewerCount - MAX_SESSIONS + 100;
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
  } else if (req.method === 'GET') {
    cleanupExpiredSessions();
    
    res.json({
      live_viewers: viewerSessions.size,
      active_sessions: viewerSessions.size,
      timestamp: getCurrentTimestamp()
    });
  } else {
    res.status(405).json({
      error: 'Method not allowed',
      status: 'error'
    });
  }
}
