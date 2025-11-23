import { MongoClient, Db, ServerApiVersion } from 'mongodb';
import 'dotenv/config';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase() {
  // 1. Return cached connection if available
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // 2. Get URI from various possible env vars
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URL;
  
  if (!uri) {
    console.error("Database Error: MONGODB_URI is missing in environment variables.");
    throw new Error("MONGODB_URI is undefined. Please add it to your environment variables.");
  }

  if (!uri.startsWith("mongodb")) {
     console.error("Database Error: Invalid MONGODB_URI format.");
     throw new Error("Invalid MONGODB_URI format. It must start with 'mongodb://' or 'mongodb+srv://'.");
  }

  try {
      // 3. Initialize Client with Serverless-optimized settings
      const client = new MongoClient(uri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        // Fail fast on connection issues (default is 30s, too long for serverless)
        connectTimeoutMS: 5000, 
        socketTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
        // Limit pool size in serverless environments
        maxPoolSize: 1,
      });

      // 4. Connect
      await client.connect();
      
      // 5. Select Database
      const dbName = process.env.MONGODB_DB || 'cyclic_app';
      const db = client.db(dbName);

      console.log(`Successfully connected to MongoDB database: ${dbName}`);

      cachedClient = client;
      cachedDb = db;
      
      return { client, db };
  } catch (error: any) {
      console.error("Failed to connect to MongoDB:", error);
      // Throwing here ensures the caller knows connection failed
      throw new Error(`Database connection failed: ${error.message}`);
  }
}