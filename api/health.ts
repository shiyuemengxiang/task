import { connectToDatabase } from './db';

export default async function handler(request: Request) {
  // 1. Stage 1: Environment Inspection
  // We grab these immediately to see if the runtime even has them
  const envCheck = {
      NODE_ENV: process.env.NODE_ENV,
      HAS_URI: !!(process.env.MONGODB_URI || process.env.MONGODB_URL),
      // Only show first 10 chars to verify it's not empty/malformed, mask the rest
      URI_PREFIX: (process.env.MONGODB_URI || process.env.MONGODB_URL) 
          ? (process.env.MONGODB_URI || process.env.MONGODB_URL)?.substring(0, 10) + "..." 
          : 'N/A',
      // List keys available (security safe)
      AVAILABLE_KEYS: Object.keys(process.env).filter(k => 
          k.toUpperCase().includes('MONGO') || 
          k.toUpperCase().includes('DB') ||
          k.toUpperCase().includes('URL') ||
          k.toUpperCase().includes('KEY')
      )
  };

  // If no URI, fail gracefully with JSON info instead of crashing in DB connect
  if (!envCheck.HAS_URI) {
      return new Response(JSON.stringify({ 
          status: 'config_error', 
          message: 'MONGODB_URI is missing from process.env',
          debug: envCheck
      }), { 
          status: 200, // Return 200 so frontend parses JSON
          headers: { 'Content-Type': 'application/json' }
      });
  }

  // 2. Stage 2: Database Connection
  try {
    const start = Date.now();
    const { db } = await connectToDatabase();
    
    // Test Read
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);
    const hasUsers = names.includes('users');

    return new Response(JSON.stringify({ 
        status: 'ok', 
        latency: Date.now() - start,
        tablesExist: hasUsers,
        collections: names,
        debug: envCheck
    }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
      console.error("Health Check Failed:", error);
      
      return new Response(JSON.stringify({ 
          status: 'db_error', 
          message: error.message,
          stack: error.stack ? error.stack.split('\n')[0] : 'No stack',
          debug: envCheck
      }), { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' }
      });
  }
}