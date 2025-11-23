import { MongoClient, Db } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MongoDB configuration missing. Please check MONGODB_URI in your Vercel project settings.");
  }

  const client = new MongoClient(uri);
  await client.connect();
  
  // Use the database name from the URI, or default to 'cyclic_app'
  // The db name is usually the path part of the URI: mongodb+srv://user:pass@host/dbname
  const db = client.db(process.env.MONGODB_DB || 'cyclic_app');

  cachedClient = client;
  cachedDb = db;
  
  return { client, db };
}