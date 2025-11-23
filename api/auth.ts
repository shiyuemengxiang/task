import { connectToDatabase } from './db.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { db } = await connectToDatabase();
    const { action, username, password } = req.body; // Vercel automatically parses JSON body

    if (action === 'register') {
      const existing = await db.collection('users').findOne({ username });
      if (existing) {
        return res.status(400).json({ success: false, message: '用户名已存在' });
      }

      await db.collection('users').insertOne({ 
        username, 
        password, 
        created_at: new Date() 
      });
      
      await db.collection('user_data').insertOne({ 
        username, 
        tasks: [], 
        updated_at: new Date() 
      });

      return res.status(200).json({ success: true, message: '注册成功' });
    } 
    
    if (action === 'login') {
      const user = await db.collection('users').findOne({ username, password });
      if (!user) {
        return res.status(401).json({ success: false, message: '用户名或密码错误' });
      }
      return res.status(200).json({ success: true, message: '登录成功' });
    }

    return res.status(400).json({ success: false, message: 'Invalid action' });

  } catch (error: any) {
    console.error("Auth API Error:", error);
    return res.status(500).json({ 
        success: false, 
        message: `DB Error: ${error.message}`,
        errorType: 'DB_CONFIG_MISSING'
    });
  }
}