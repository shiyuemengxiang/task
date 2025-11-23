import { MongoClient, Db, ServerApiVersion } from 'mongodb';
import 'dotenv/config';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase() {
  console.log("[DB] Attempting connection...");

  if (cachedClient && cachedDb) {
     console.log("[DB] Returning cached connection");
     return { client: cachedClient, db: cachedDb };
  }

  // 1. Diagnostics: Check Environment Variables
  const envKeys = Object.keys(process.env);
  const mongoKeys = envKeys.filter(k => k.toUpperCase().includes('MONGO') || k.toUpperCase().includes('DB'));
  console.log("[DB] Available Env Keys:", JSON.stringify(mongoKeys));

  let uri = process.env.MONGODB_URI || process.env.MONGODB_URL;
  const dbName = process.env.MONGODB_DB || 'cyclic_app';

  if (!uri) {
      const msg = `MONGODB_URI is undefined. Available keys in process.env: ${mongoKeys.join(', ')}`;
      console.error(msg);
      throw new Error(msg);
  }

  // 2. Sanitization
  // Trim whitespace
  uri = uri.trim();
  // Remove wrapping quotes if present (common .env parsing issue)
  if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
      uri = uri.slice(1, -1);
  }

  // Log masked URI for security
  const maskedUri = uri.replace(/(:)([^:@]+)(@)/, '$1*****$3'); 
  console.log(`[DB] Using URI (Masked): ${maskedUri}`);

  // Basic validation
  if (!uri.startsWith("mongodb")) {
      const msg = `Invalid Protocol. URI starts with: '${uri.substring(0, 10)}...' (Expected 'mongodb://' or 'mongodb+srv://')`;
      console.error(msg);
      throw new Error(msg);
  }

  try {
      // 3. Connection
      console.log("[DB] Initializing MongoClient...");
      const client = new MongoClient(uri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        // Serverless optimizations
        connectTimeoutMS: 10000, 
        socketTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 1, 
      });

      console.log("[DB] client.connect() called...");
      await client.connect();
      console.log("[DB] Connected to cluster.");

      const db = client.db(dbName);
      
      // Ping to verify
      await db.command({ ping: 1 });
      console.log(`[DB] Ping successful. Database selected: ${dbName}`);

      cachedClient = client;
      cachedDb = db;
      
      return { client, db };
  } catch (error: any) {
      console.error("[DB] FATAL CONNECTION ERROR:", error);
      // Include specific error name and message
      throw new Error(`DB Connect Error: [${error.name}] ${error.message}`);
  }
}