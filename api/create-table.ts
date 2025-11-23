import { connectToDatabase } from './db';

export default async function handler(request: Request) {
  try {
    const { db } = await connectToDatabase();

    // MongoDB is schema-less, so we don't create tables.
    // However, we can ensure unique indexes exist to enforce constraints.

    // Create Unique Index for users.username
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    
    // Create Unique Index for user_data.username
    await db.collection('user_data').createIndex({ username: 1 }, { unique: true });

    return new Response(JSON.stringify({ message: 'MongoDB initialized (Indexes ensured)' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error: any) {
    console.error("Init DB Error:", error);
    return new Response(JSON.stringify({ 
        error: error.message || 'Unknown Error', 
        details: 'Check Vercel MONGODB_URI settings.'
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}