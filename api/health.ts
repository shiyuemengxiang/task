import { connectToDatabase } from './db';

export default async function handler(request: Request) {
  // Capture Environment State immediately for debugging
  const debugInfo = {
      NODE_ENV: process.env.NODE_ENV,
      HAS_URI: !!(process.env.MONGODB_URI || process.env.MONGODB_URL),
      URI_PREFIX: (process.env.MONGODB_URI || process.env.MONGODB_URL)?.substring(0, 12) + "...",
      MONGO_KEYS: Object.keys(process.env).filter(k => k.toUpperCase().includes('MONGO')),
  };

  try {
    const start = Date.now();
    const { db } = await connectToDatabase();
    
    // Test Read: List collections
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);
    const hasUsers = names.includes('users');

    return new Response(JSON.stringify({ 
        status: 'ok', 
        latency: Date.now() - start,
        tablesExist: hasUsers,
        collections: names,
        debug: debugInfo
    }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
      console.error("Health Check Failed:", error);
      
      // Return 200 with error details so frontend can display them instead of a generic 500 page
      return new Response(JSON.stringify({ 
          status: 'error', 
          message: error.message,
          stack: error.stack ? error.stack.split('\n')[0] : 'No stack',
          debug: debugInfo
      }), { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' }
      });
  }
}