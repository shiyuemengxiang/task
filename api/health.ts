import { connectToDatabase } from './db.js';

// Vercel Node.js Handler Signature: (req, res)
export default async function handler(req: any, res: any) {
  // Stage 1: Env Check
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.DATABASE_URL;
  
  const envCheck = {
      NODE_ENV: process.env.NODE_ENV,
      HAS_URI: !!uri,
      URI_PREFIX: uri ? uri.substring(0, 12) + "..." : 'N/A',
      AVAILABLE_KEYS: Object.keys(process.env).filter(k => 
          k.toUpperCase().includes('MONGO') || 
          k.toUpperCase().includes('DB') ||
          k.toUpperCase().includes('URL') ||
          k.toUpperCase().includes('KEY')
      )
  };

  if (!envCheck.HAS_URI) {
      // Return 200 OK with error info so frontend displays it nicely instead of crashing
      return res.status(200).json({ 
          status: 'config_error', 
          message: 'MongoDB URI is missing in environment variables.',
          debug: envCheck
      });
  }

  // Stage 2: DB Connection
  try {
    const start = Date.now();
    const { db } = await connectToDatabase();
    
    // Check if 'users' collection exists
    const collections = await db.listCollections().toArray();
    const names = collections.map((c: any) => c.name);
    const hasUsers = names.includes('users');

    return res.status(200).json({ 
        status: 'ok', 
        latency: Date.now() - start,
        tablesExist: hasUsers,
        collections: names,
        debug: envCheck
    });

  } catch (error: any) {
      console.error("Health Check Error:", error);
      return res.status(200).json({ 
          status: 'db_error', 
          message: error.message,
          errorName: error.name,
          debug: envCheck
      });
  }
}