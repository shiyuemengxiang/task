import { createPool } from '@vercel/postgres';

// Centralized database connection helper
// This ensures we can connect whether using Vercel Postgres (Neon) or Prisma Postgres
export const getDb = () => {
    // 1. Try POSTGRES_URL (Standard Vercel Postgres)
    // 2. Try DATABASE_URL (Standard Prisma / Generic Postgres)
    // 3. Try PRISMA_DATABASE_URL (Specific Prisma)
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL;
    
    if (!url) {
        console.error("Database Connection Error: No connection string found (POSTGRES_URL or DATABASE_URL is missing).");
        throw new Error("Database configuration missing. Please check POSTGRES_URL or DATABASE_URL in Vercel settings.");
    }

    // Create a pool with the found connection string
    return createPool({
        connectionString: url,
        /* 
           SSL is strictly required for Vercel/Neon/Prisma Postgres.
           @vercel/postgres defaults ssl to true, but we can be explicit if needed.
           If you encounter self-signed cert errors (rare on Vercel), you might need { rejectUnauthorized: false }
        */
        ssl: true 
    });
};