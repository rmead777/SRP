    module.exports = {
  // Session timeout in milliseconds (60 seconds)
  SESSION_TIMEOUT: 60 * 1000,
  
  // Cleanup interval in milliseconds (30 seconds)
  CLEANUP_INTERVAL: 30 * 1000,
  
  // Maximum number of sessions to track (prevent memory bloat)
  MAX_SESSIONS: 10000,
    // CORS settings
  CORS_ORIGINS: [
    'https://lastbuyerbonanza.com',
    'https://www.lastbuyerbonanza.com',
    'http://localhost:3000',
    'http://localhost:8000',
    'https://my-vercel-html-lirarz4hg-ryans-projects-d565ecc1.vercel.app',
    'https://*.vercel.app'
  ],
  
  // Debug mode
  DEBUG: process.env.NODE_ENV !== 'production',
  
  // Port for local development
  PORT: process.env.PORT || 3001
};
