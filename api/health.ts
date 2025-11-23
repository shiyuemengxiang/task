import { sql } from '@vercel/postgres';

export default async function handler(request: Request) {
  try {
    if (!process.env.POSTGRES_URL) {
       return new Response(JSON.stringify({ 
        status: 'error', 
        message: 'Environment variable POSTGRES_URL is missing' 
      }), { status: 500 });
    }

    const start = Date.now();
    // 1. Connectivity Check
    await sql`SELECT 1`; 
    
    // 2. Table Check
    const tableCheck = await sql`
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
        tablesExist 
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