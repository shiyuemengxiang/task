import { connectToDatabase } from './db.js';

export default async function handler(req: any, res: any) {
  try {
    const { db } = await connectToDatabase();

    // Create Indexes
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('user_data').createIndex({ username: 1 }, { unique: true });

    return res.status(200).json({ message: 'MongoDB initialized (Indexes ensured)' });
  } catch (error: any) {
    console.error("Init DB Error:", error);
    return res.status(500).json({ 
        error: error.message || 'Unknown Error', 
        details: 'Check Vercel MONGODB_URI settings.'
    });
  }
}