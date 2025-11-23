import { sql } from '@vercel/postgres';

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username');

  // Simple auth check via username param for this demo level. 
  // In production, use session tokens or JWT cookies.
  if (!username && request.method === 'GET') {
    return new Response(JSON.stringify({ error: 'Username required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    if (request.method === 'GET') {
      const result = await sql`SELECT tasks FROM user_data WHERE username = ${username}`;
      const tasks = result.rows[0]?.tasks || [];
      
      const userResult = await sql`SELECT webhook_url FROM users WHERE username = ${username}`;
      const webhookUrl = userResult.rows[0]?.webhook_url || '';

      return new Response(JSON.stringify({ tasks, webhookUrl }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    if (request.method === 'POST') {
      const { tasks, webhookUrl, username: bodyUsername } = await request.json();
      const targetUser = bodyUsername || username;

      if (!targetUser) {
           return new Response(JSON.stringify({ success: false, message: 'Username required' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
      }
      
      // Update tasks
      if (tasks) {
        await sql`
          INSERT INTO user_data (username, tasks, updated_at)
          VALUES (${targetUser}, ${JSON.stringify(tasks)}::jsonb, NOW())
          ON CONFLICT (username) 
          DO UPDATE SET tasks = ${JSON.stringify(tasks)}::jsonb, updated_at = NOW();
        `;
      }

      // Update settings if provided
      if (webhookUrl !== undefined) {
         await sql`UPDATE users SET webhook_url = ${webhookUrl} WHERE username = ${targetUser}`;
      }

      return new Response(JSON.stringify({ success: true }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

  } catch (error: any) {
    console.error("Tasks API Error", error);
    // If table doesn't exist, we return empty list for GET or fail gracefully
    if (error.code === '42P01') {
         if (request.method === 'GET') {
             return new Response(JSON.stringify({ tasks: [], webhookUrl: '' }), { 
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
         }
    }

    return new Response(JSON.stringify({ error: 'Database error', details: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}