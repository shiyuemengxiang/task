import { sql } from '@vercel/postgres';

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username');

  if (!username) {
    return new Response('Username required', { status: 400 });
  }

  try {
    if (request.method === 'GET') {
      const result = await sql`SELECT tasks FROM user_data WHERE username = ${username}`;
      const tasks = result.rows[0]?.tasks || [];
      
      // Also get settings
      const userResult = await sql`SELECT webhook_url FROM users WHERE username = ${username}`;
      const webhookUrl = userResult.rows[0]?.webhook_url || '';

      return new Response(JSON.stringify({ tasks, webhookUrl }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    if (request.method === 'POST') {
      const { tasks, webhookUrl } = await request.json();
      
      // Update tasks
      if (tasks) {
        await sql`
          INSERT INTO user_data (username, tasks, updated_at)
          VALUES (${username}, ${JSON.stringify(tasks)}::jsonb, NOW())
          ON CONFLICT (username) 
          DO UPDATE SET tasks = ${JSON.stringify(tasks)}::jsonb, updated_at = NOW();
        `;
      }

      // Update settings if provided
      if (webhookUrl !== undefined) {
         await sql`UPDATE users SET webhook_url = ${webhookUrl} WHERE username = ${username}`;
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
  }
}