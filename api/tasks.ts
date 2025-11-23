import { connectToDatabase } from './db';

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username');

  if (!username && request.method === 'GET') {
    return new Response(JSON.stringify({ error: 'Username required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { db } = await connectToDatabase();

    if (request.method === 'GET') {
      const userData = await db.collection('user_data').findOne({ username });
      const tasks = userData?.tasks || [];
      
      const user = await db.collection('users').findOne({ username });
      const webhookUrl = user?.webhook_url || '';

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
      
      if (tasks) {
        await db.collection('user_data').updateOne(
            { username: targetUser },
            { 
                $set: { tasks, updated_at: new Date() } 
            },
            { upsert: true }
        );
      }

      if (webhookUrl !== undefined) {
         await db.collection('users').updateOne(
             { username: targetUser },
             { $set: { webhook_url: webhookUrl } }
         );
      }

      return new Response(JSON.stringify({ success: true }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

  } catch (error: any) {
    console.error("Tasks API Error", error);
    return new Response(JSON.stringify({ error: 'Database error', details: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}