import { MongoClient, Db, ServerApiVersion } from 'mongodb';

// NOTE: Removed 'dotenv' import. In Vercel/Serverless, env vars are injected automatically.
// Importing dotenv causing top-level execution can crash the function if .env file is missing/unreadable.

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase() {
  // Check common variable names for MongoDB connection string
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.DATABASE_URL;
  const dbName = process.env.MONGODB_DB || 'cyclic_app';

  if (cachedClient && cachedDb) {
     return { client: cachedClient, db: cachedDb };
  }

  if (!uri) {
      // Diagnostic error to help debug in Vercel Logs
      const availableKeys = Object.keys(process.env).filter(k => 
          k.toUpperCase().includes('MONGO') || 
          k.toUpperCase().includes('DB') || 
          k.toUpperCase().includes('URL')
      );
      throw new Error(`MongoDB URI is undefined. Checked MONGODB_URI, MONGODB_URL, DATABASE_URL. Found keys: [${availableKeys.join(', ')}]`);
  }

  // Sanitization: Remove wrapping quotes if present (common .env mistake)
  let cleanUri = uri.trim();
  if ((cleanUri.startsWith('"') && cleanUri.endsWith('"')) || (cleanUri.startsWith("'") && cleanUri.endsWith("'"))) {
      cleanUri = cleanUri.slice(1, -1);
  }

  try {
      const client = new MongoClient(cleanUri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        // Serverless optimizations
        connectTimeoutMS: 5000, // Fail fast (5s) instead of hanging
        socketTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 1, // Prevent connection exhaustion in serverless
      });

      await client.connect();
      const db = client.db(dbName);
      
      // Ping to verify connection validity
      await db.command({ ping: 1 });

      cachedClient = client;
      cachedDb = db;
      
      console.log(`[DB] Connected successfully to ${dbName}`);
      return { client, db };
  } catch (error: any) {
      console.error("[DB] Connection Error Details:", error);
      throw new Error(`DB Connection Failed: ${error.name} - ${error.message}`);
  }
}