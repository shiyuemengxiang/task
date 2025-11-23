import { connectToDatabase } from './db';

export default async function handler(request: Request) {
  // Stage 1: Environment Inspection (Safe Check)
  // We check multiple common variable names
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.DATABASE_URL;
  
  const envCheck = {
      NODE_ENV: process.env.NODE_ENV,
      HAS_URI: !!uri,
      // Show first 12 chars to verify protocol (e.g. "mongodb+srv:...") without leaking credentials
      URI_PREFIX: uri ? uri.substring(0, 12) + "..." : 'N/A',
      // List available keys related to DB for debugging
      AVAILABLE_KEYS: Object.keys(process.env).filter(k => 
          k.toUpperCase().includes('MONGO') || 
          k.toUpperCase().includes('DB') ||
          k.toUpperCase().includes('URL') ||
          k.toUpperCase().includes('KEY')
      )
  };

  // If no URI, return 200 OK with specific status so frontend can display "Config Error" instead of 500 Crash
  if (!envCheck.HAS_URI) {
      return new Response(JSON.stringify({ 
          status: 'config_error', 
          message: 'MongoDB Connection String is missing. Please set MONGODB_URI in Vercel Environment Variables.',
          debug: envCheck
      }), { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' }
      });
  }

  // Stage 2: Database Connection
  try {
    const start = Date.now();
    const { db } = await connectToDatabase();
    
    // Test Read: List collections to ensure permissions are correct
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
      
      // Return 200 with error details so frontend can display them nicely
      return new Response(JSON.stringify({ 
          status: 'db_error', 
          message: error.message,
          errorName: error.name,
          debug: envCheck
      }), { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' }
      });
  }
}