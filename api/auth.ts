import { sql } from '@vercel/postgres';

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { action, username, password } = await request.json();

    if (action === 'register') {
      // Check existence
      const existing = await sql`SELECT * FROM users WHERE username = ${username}`;
      if (existing.rows.length > 0) {
        return new Response(JSON.stringify({ success: false, message: '用户名已存在' }), { status: 400 });
      }

      // Insert User
      await sql`INSERT INTO users (username, password) VALUES (${username}, ${password})`;
      // Init Data
      await sql`INSERT INTO user_data (username, tasks) VALUES (${username}, '[]'::jsonb)`;

      return new Response(JSON.stringify({ success: true, message: '注册成功' }), { status: 200 });
    } 
    
    if (action === 'login') {
      const user = await sql`SELECT * FROM users WHERE username = ${username} AND password = ${password}`;
      if (user.rows.length === 0) {
        return new Response(JSON.stringify({ success: false, message: '用户名或密码错误' }), { status: 401 });
      }
      return new Response(JSON.stringify({ success: true, message: '登录成功' }), { status: 200 });
    }

    return new Response('Invalid action', { status: 400 });

  } catch (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }
}