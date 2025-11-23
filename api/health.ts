import { getDb } from './db';

export default async function handler(request: Request) {
  const envStatus = {
      POSTGRES_URL: !!process.env.POSTGRES_URL,
      DATABASE_URL: !!process.env.DATABASE_URL,
      PRISMA_DATABASE_URL: !!process.env.PRISMA_DATABASE_URL,
  };

  try {
    if (!envStatus.POSTGRES_URL && !envStatus.DATABASE_URL && !envStatus.PRISMA_DATABASE_URL) {
       // Return 200 with error status so frontend can display details
       return new Response(JSON.stringify({ 
        status: 'config_error', 
        message: 'No Environment Variables Found. Please add POSTGRES_URL or DATABASE_URL to Vercel Settings.',
        env: envStatus
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

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
      
      // Return 200 with error details to allow frontend to render the specific DB error
      return new Response(JSON.stringify({ 
          status: 'error', 
          message: error.message || 'Unknown Database Error',
          code: error.code,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          env: envStatus
      }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
      });
  }
}