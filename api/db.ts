import { MongoClient, Db, ServerApiVersion } from 'mongodb';

// NOTE: We do NOT import dotenv here to avoid file-system access issues in Serverless.
// Vercel injects environment variables automatically.

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase() {
  // 1. Safe Environment Check
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.DATABASE_URL;
  const dbName = process.env.MONGODB_DB || 'cyclic_app';

  if (cachedClient && cachedDb) {
     return { client: cachedClient, db: cachedDb };
  }

  if (!uri) {
      // Collect available keys for debugging (masking values)
      const availableKeys = Object.keys(process.env).filter(k => 
          k.toUpperCase().includes('MONGO') || 
          k.toUpperCase().includes('DB') || 
          k.toUpperCase().includes('URL')
      );
      throw new Error(`MongoDB URI is missing. Checked: MONGODB_URI, MONGODB_URL, DATABASE_URL. Available Env Keys: [${availableKeys.join(', ')}]`);
  }

  // 2. Sanitization (Handle accidental quotes in .env)
  let cleanUri = uri.trim();
  if ((cleanUri.startsWith('"') && cleanUri.endsWith('"')) || (cleanUri.startsWith("'") && cleanUri.endsWith("'"))) {
      cleanUri = cleanUri.slice(1, -1);
  }

  try {
      // 3. Connect
      const client = new MongoClient(cleanUri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        connectTimeoutMS: 10000, // 10s timeout
        socketTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 1, // Optimization for serverless
      });

      await client.connect();
      const db = client.db(dbName);
      
      // 4. Verify
      await db.command({ ping: 1 });

      cachedClient = client;
      cachedDb = db;
      
      console.log(`[DB] Connected to ${dbName}`);
      return { client, db };
  } catch (error: any) {
      console.error("[DB] Connection Failed:", error);
      throw new Error(`DB Connection Failed: ${error.name} - ${error.message}`);
  }
}