import { connectToDatabase } from './db.js';

export default async function handler(req: any, res: any) {
  const username = req.query.username;

  if (!username && req.method === 'GET') {
    return res.status(400).json({ error: 'Username required' });
  }

  try {
    const { db } = await connectToDatabase();

    if (req.method === 'GET') {
      const userData = await db.collection('user_data').findOne({ username });
      const tasks = userData?.tasks || [];
      const groupOrder = userData?.group_order || []; // Retrieve group order
      
      const user = await db.collection('users').findOne({ username });
      const webhookUrl = user?.webhook_url || '';

      return res.status(200).json({ tasks, groupOrder, webhookUrl });
    }

    if (req.method === 'POST') {
      const { tasks, groupOrder, webhookUrl, username: bodyUsername } = req.body;
      const targetUser = bodyUsername || username;

      if (!targetUser) {
           return res.status(400).json({ success: false, message: 'Username required' });
      }
      
      if (tasks || groupOrder) {
        const updateFields: any = { updated_at: new Date() };
        if (tasks) updateFields.tasks = tasks;
        if (groupOrder) updateFields.group_order = groupOrder;

        await db.collection('user_data').updateOne(
            { username: targetUser },
            { 
                $set: updateFields 
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

      return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error("Tasks API Error", error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}