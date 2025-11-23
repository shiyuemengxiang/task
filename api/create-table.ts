import { getDb } from './db';

export default async function handler(request: Request) {
  try {
    const db = getDb(); // Will throw specific error if env vars are missing

    // Create Users Table
    await db.sql`
      CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(255) PRIMARY KEY,
        password VARCHAR(255) NOT NULL,
        webhook_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create Tasks Table (Storing tasks as a JSON blob for simplicity and flexibility)
    await db.sql`
      CREATE TABLE IF NOT EXISTS user_data (
        username VARCHAR(255) PRIMARY KEY REFERENCES users(username),
        tasks JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    return new Response(JSON.stringify({ message: 'Tables created successfully' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error: any) {
    console.error("Create Table Error:", error);
    return new Response(JSON.stringify({ 
        error: error.message || 'Unknown Error', 
        details: 'Check Vercel Storage settings and ensure POSTGRES_URL or DATABASE_URL is correct.'
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}