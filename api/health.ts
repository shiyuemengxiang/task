import { getDb } from './db';

export default async function handler(request: Request) {
  try {
    const hasPostgres = !!process.env.POSTGRES_URL;
    const hasDatabase = !!process.env.DATABASE_URL;
    
    if (!hasPostgres && !hasDatabase) {
       return new Response(JSON.stringify({ 
        status: 'error', 
        message: 'Configuration Error: Both POSTGRES_URL and DATABASE_URL are missing.' 
      }), { status: 500 });
    }

    const db = getDb();
    const start = Date.now();
    
    // 1. Connectivity Check
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
        configSource: hasPostgres ? 'POSTGRES_URL' : 'DATABASE_URL'
    }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
      console.error('Health Check Error:', error);
      return new Response(JSON.stringify({ 
          status: 'error', 
          message: error.message,
          code: error.code
      }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
      });
  }
}