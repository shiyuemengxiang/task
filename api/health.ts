import { connectToDatabase } from './db';

export default async function handler(request: Request) {
  const envStatus = {
      MONGODB_URI_EXISTS: !!(process.env.MONGODB_URI || process.env.MONGODB_URL),
      MONGODB_DB: process.env.MONGODB_DB || 'default(cyclic_app)',
      NODE_ENV: process.env.NODE_ENV
  };

  try {
    const start = Date.now();
    
    // Step 1: Connection
    let db;
    try {
        const connection = await connectToDatabase();
        db = connection.db;
    } catch (connError: any) {
        return new Response(JSON.stringify({ 
            status: 'error',
            stage: 'connection',
            message: connError.message,
            env: envStatus
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Step 2: Ping
    try {
        await db.command({ ping: 1 });
    } catch (pingError: any) {
        return new Response(JSON.stringify({ 
            status: 'error',
            stage: 'ping',
            message: `Connected but Ping failed: ${pingError.message}`,
            env: envStatus
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    
    // Step 3: Collections
    const collections = await db.listCollections().toArray();
    const hasUsers = collections.some(c => c.name === 'users');

    return new Response(JSON.stringify({ 
        status: 'ok', 
        latency: Date.now() - start,
        tablesExist: hasUsers,
        env: envStatus
    }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
      // Catch-all for unexpected runtime errors
      return new Response(JSON.stringify({ 
          status: 'fatal_error', 
          message: error.message || 'Unknown Critical Error',
          env: envStatus
      }), { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' }
      });
  }
}