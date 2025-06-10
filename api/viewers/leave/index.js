// This needs to share the same storage as the main viewers endpoint
// For simplicity in serverless, we'll use a simple approach

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method === 'POST') {
    try {
      const { session_id } = req.body;
      
      if (!session_id) {
        return res.status(400).json({
          error: 'Missing required field: session_id',
          status: 'error'
        });
      }
      
      // In a serverless environment, we can't easily share state
      // This endpoint acknowledges the leave but doesn't track it
      // The main cleanup happens via timeout in the main endpoint
      
      res.json({
        status: 'acknowledged',
        live_viewers: 0, // We can't get real count from here
        session_id: session_id
      });
      
    } catch (error) {
      console.error('Error in POST /api/viewers/leave:', error);
      res.status(500).json({
        error: 'Internal server error',
        status: 'error'
      });
    }
  } else {
    res.status(405).json({
      error: 'Method not allowed',
      status: 'error'
    });
  }
}
