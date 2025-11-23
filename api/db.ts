import { createPool } from '@vercel/postgres';

// Centralized database connection helper
export const getDb = () => {
    // 1. Try POSTGRES_URL (Standard Vercel Postgres)
    // 2. Try DATABASE_URL (Standard Prisma / Generic Postgres)
    // 3. Try PRISMA_DATABASE_URL (Specific Prisma)
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL;
    
    // Log which keys exist (security: do not log the actual secrets)
    console.log("DB Init Check:", {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasPrismaUrl: !!process.env.PRISMA_DATABASE_URL,
        selectedUrlLength: url?.length
    });

    if (!url) {
        console.error("Database Connection Error: No connection string found.");
        throw new Error("Database configuration missing. Please check POSTGRES_URL or DATABASE_URL in Vercel settings.");
    }

    // Create a pool with the found connection string
    return createPool({
        connectionString: url,
        /* 
           SSL Configuration:
           We use 'rejectUnauthorized: false' to allow connections to databases 
           that might use self-signed certificates or have complex SSL chains (common in some serverless/pooling setups).
           This resolves many "Connection Timeout" or "SSL Error" issues.
        */
        ssl: {
            rejectUnauthorized: false
        }
    });
};