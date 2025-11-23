import { createPool } from '@vercel/postgres';

// Use a global variable to store the pool across hot reloads in development
// and container reuse in production lambda environments.
let pool: any;

export const getDb = () => {
    if (pool) return pool;

    let url = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL;

    console.log("DB Init Check:", {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasPrismaUrl: !!process.env.PRISMA_DATABASE_URL,
        urlPrefix: url ? url.split('://')[0] : 'none'
    });

    if (!url) {
        // If no URL is found, we throw an error that will be caught by the API handlers.
        // We do NOT return a pool here to prevent 'undefined' errors later.
        throw new Error("Database configuration missing. Please check POSTGRES_URL or DATABASE_URL in Vercel settings.");
    }

    // FIX: Prisma Postgres uses 'prisma+postgres://' protocol which the standard pg driver does not understand.
    // We must convert it to 'postgres://' for the @vercel/postgres (pg) driver to work.
    if (url.startsWith('prisma+postgres://')) {
        url = url.replace('prisma+postgres://', 'postgres://');
        console.log("Converted prisma+postgres:// to postgres:// for driver compatibility.");
    }

    // Create a pool with the found connection string
    // We set a connectionTimeoutMillis to fail fast if the DB is sleeping or unreachable,
    // avoiding the request hanging until Vercel kills it (504 Gateway Timeout).
    pool = createPool({
        connectionString: url,
        ssl: {
            rejectUnauthorized: false
        },
        connectionTimeoutMillis: 5000, // 5 seconds timeout
        max: 1 // Keep max connections low for serverless
    });

    return pool;
};