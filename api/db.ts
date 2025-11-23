import { createPool } from '@vercel/postgres';

let pool: any = null;

export const getDb = () => {
    // Singleton pattern: reuse pool if already created
    if (pool) return pool;

    let connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL;

    // CRITICAL FIX: The Vercel/Prisma integration sometimes injects 'prisma+postgres://' 
    // which causes standard drivers to crash. We must replace it with 'postgres://'.
    if (connectionString && connectionString.startsWith('prisma+postgres://')) {
        connectionString = connectionString.replace('prisma+postgres://', 'postgres://');
    }

    if (!connectionString) {
        throw new Error("Database configuration missing. Please check POSTGRES_URL or DATABASE_URL in Vercel settings.");
    }

    // Initialize the pool using @vercel/postgres which handles serverless lifecycle correctly
    pool = createPool({
        connectionString,
        ssl: { rejectUnauthorized: false }, // Robust SSL setting for cloud DBs
        max: 1 // Keep max connections low for serverless
    });

    return pool;
};