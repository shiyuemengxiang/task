import { getDb } from './db';

export default async function handler(request: Request) {
  const envStatus = {
      POSTGRES_URL: !!process.env.POSTGRES_URL,
      DATABASE_URL: !!process.env.DATABASE_URL,
  };

  try {
    // Attempt to get DB instance (might throw if config is missing)
    const db = getDb();
    const start = Date.now();
    
    // 1. Connectivity Check (Simple Query)
    await db.sql`SELECT 1`; 
    
    // 2. Table Check
    const tableCheck = await db.sql`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
        );
    `;
    const tablesExist = tableCheck.rows[0].exists;

    return new Response(JSON.stringify({ 
        status: 'ok', 
        latency: Date.now() - start,
        tablesExist,
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
          code: error.code,
          env: envStatus
      }), { 
          status: 200, // Return 200 so client can parse JSON and show the error message
          headers: { 'Content-Type': 'application/json' }
      });
  }
}