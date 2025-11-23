import { connectToDatabase } from './db';

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Method Not Allowed' }), { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { db } = await connectToDatabase();
    const { action, username, password } = await request.json();

    if (action === 'register') {
      // Check existence
      const existing = await db.collection('users').findOne({ username });
      if (existing) {
        return new Response(JSON.stringify({ success: false, message: '用户名已存在' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
      }

      // Insert User
      await db.collection('users').insertOne({ 
        username, 
        password, 
        created_at: new Date() 
      });
      
      // Init Data
      await db.collection('user_data').insertOne({ 
        username, 
        tasks: [], 
        updated_at: new Date() 
      });

      return new Response(JSON.stringify({ success: true, message: '注册成功' }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
      });
    } 
    
    if (action === 'login') {
      const user = await db.collection('users').findOne({ username, password });
      if (!user) {
        return new Response(JSON.stringify({ success: false, message: '用户名或密码错误' }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: true, message: '登录成功' }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, message: 'Invalid action' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Auth API Error:", error);

    // Pass the actual error message to the client for debugging
    // In production, you might want to sanitize this, but for now we need to see why connection fails
    return new Response(JSON.stringify({ 
        success: false, 
        message: `DB Error: ${error.message}`,
        errorType: 'DB_CONFIG_MISSING'
    }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}