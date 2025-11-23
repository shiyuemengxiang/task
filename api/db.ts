import { createPool } from '@vercel/postgres';

export const getDb = () => {
    // 1. Retrieve and Sanitize Connection String
    const rawUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL || '';
    
    // Fix for "prisma+postgres://" protocol which crashes standard drivers
    const connectionString = rawUrl.replace('prisma+postgres://', 'postgres://');

    if (!connectionString) {
        console.error("DB Error: Missing connection string");
        throw new Error("Database configuration missing. Check POSTGRES_URL in Vercel.");
    }

    // 2. Create Pool using Vercel SDK
    // This SDK is optimized for Serverless (manages connection freezing/thawing)
    const pool = createPool({
        connectionString,
        /* 
         * SSL is handled automatically by @vercel/postgres based on the environment.
         * We don't need to manually set rejectUnauthorized: false here usually, 
         * but if you are using a custom external Postgres, you might need it. 
         * For Vercel Postgres, default is fine.
         */
    });

    // 3. Return wrapper compatible with existing code (db.sql`...`)
    return {
        sql: async (strings: TemplateStringsArray, ...values: any[]) => {
            try {
                // @ts-ignore - Vercel SDK types might be slightly different but runtime is compatible
                return await pool.sql(strings, ...values);
            } catch (error) {
                console.error("SQL Execution Error:", error);
                throw error;
            }
        }
    };
};