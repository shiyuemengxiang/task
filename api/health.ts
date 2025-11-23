import { connectToDatabase } from './db';

export default async function handler(request: Request) {
  const envStatus = {
      MONGODB_URI: !!process.env.MONGODB_URI,
  };

  try {
    const start = Date.now();
    const { db } = await connectToDatabase();
    
    // 1. Connectivity Check
    await db.command({ ping: 1 });
    
    // 2. Collections Check
    const collections = await db.listCollections().toArray();
    const hasUsers = collections.some(c => c.name === 'users');

    return new Response(JSON.stringify({ 
        status: 'ok', 
        latency: Date.now() - start,
        tablesExist: hasUsers, // Reusing key for frontend compatibility
        env: envStatus
    }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
      console.error('Health Check Error:', error);
      
      return new Response(JSON.stringify({ 
          status: 'error', 
          message: error.message || 'Unknown Database Error',
          env: envStatus
      }), { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' }
      });
  }
}