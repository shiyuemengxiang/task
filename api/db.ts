import { MongoClient, Db, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';

// Safely load env vars without crashing if .env is missing
try {
  dotenv.config();
} catch (e) {
  // Ignore dotenv errors in production/serverless
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase() {
  // 1. Diagnostics: Check Environment Variables safely
  // We do not throw immediately here to allow health check to inspect env state first
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URL;
  const dbName = process.env.MONGODB_DB || 'cyclic_app';

  if (cachedClient && cachedDb) {
     return { client: cachedClient, db: cachedDb };
  }

  // 2. Validation
  if (!uri) {
      const envKeys = Object.keys(process.env).filter(k => k.toUpperCase().includes('MONGO') || k.toUpperCase().includes('DB'));
      throw new Error(`MONGODB_URI is undefined. Available keys: [${envKeys.join(', ')}]`);
  }

  // Sanitization
  let cleanUri = uri.trim();
  // Remove wrapping quotes if present
  if ((cleanUri.startsWith('"') && cleanUri.endsWith('"')) || (cleanUri.startsWith("'") && cleanUri.endsWith("'"))) {
      cleanUri = cleanUri.slice(1, -1);
  }

  try {
      // 3. Connection
      const client = new MongoClient(cleanUri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        // Serverless optimizations
        connectTimeoutMS: 5000, 
        socketTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 1, 
      });

      await client.connect();
      const db = client.db(dbName);
      
      // Ping to verify
      await db.command({ ping: 1 });

      cachedClient = client;
      cachedDb = db;
      
      return { client, db };
  } catch (error: any) {
      console.error("[DB] Connection Error:", error);
      throw new Error(`DB Connection Failed: ${error.name} - ${error.message}`);
  }
}