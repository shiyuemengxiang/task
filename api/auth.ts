import { sql } from '@vercel/postgres';

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Method Not Allowed' }), { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
    });
  }

  // Critical Check: Ensure Database is connected
  if (!process.env.POSTGRES_URL) {
    return new Response(JSON.stringify({ 
        success: false, 
        message: '系统配置错误: 未连接数据库 (Missing POSTGRES_URL)。请在 Vercel 控制台 Storage 选项卡中连接 Postgres 数据库。' 
    }), { 
        status: 500,
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
            console.log("Tables missing, attempting creation...");
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
            return new Response(JSON.stringify({ success: false, message: '系统初始化完成，请再次点击登录/注册' }), { 
                status: 200, // Return 200 so frontend handles it gracefully as a soft error
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (initError: any) {
             console.error("Table creation failed:", initError);
             return new Response(JSON.stringify({ success: false, message: `数据库初始化失败: ${initError.message}` }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    return new Response(JSON.stringify({ success: false, message: `服务器错误: ${error.message || 'Unknown Error'}` }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}