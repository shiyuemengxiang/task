import { sql } from '@vercel/postgres';

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Method Not Allowed' }), { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { action, username, password } = await request.json();

    if (action === 'register') {
      // Check existence
      const existing = await sql`SELECT * FROM users WHERE username = ${username}`;
      if (existing.rows.length > 0) {
        return new Response(JSON.stringify({ success: false, message: '用户名已存在' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
      }

      // Insert User
      await sql`INSERT INTO users (username, password) VALUES (${username}, ${password})`;
      // Init Data
      await sql`INSERT INTO user_data (username, tasks) VALUES (${username}, '[]'::jsonb)`;

      return new Response(JSON.stringify({ success: true, message: '注册成功' }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
      });
    } 
    
    if (action === 'login') {
      const user = await sql`SELECT * FROM users WHERE username = ${username} AND password = ${password}`;
      if (user.rows.length === 0) {
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

    // Self-Healing: If table does not exist (Postgres Error 42P01), try to create it and ask user to retry.
    if (error.code === '42P01') {
        try {
            await sql`
              CREATE TABLE IF NOT EXISTS users (
                username VARCHAR(255) PRIMARY KEY,
                password VARCHAR(255) NOT NULL,
                webhook_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`
              CREATE TABLE IF NOT EXISTS user_data (
                username VARCHAR(255) PRIMARY KEY REFERENCES users(username),
                tasks JSONB DEFAULT '[]'::jsonb,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            return new Response(JSON.stringify({ success: false, message: '数据库初始化完成，请再次点击按钮' }), { 
                status: 200, // Return 200 so frontend handles it gracefully
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (initError) {
             return new Response(JSON.stringify({ success: false, message: '数据库初始化失败' }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    return new Response(JSON.stringify({ success: false, message: `服务器错误: ${error.message || 'Unknown'}` }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}