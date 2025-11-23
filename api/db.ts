import pg from 'pg';
const { Pool } = pg;

// Use a global variable to maintain the pool across hot reloads in development
// and across invocations in serverless (if the container is reused).
let globalPool: pg.Pool | null = null;

export const getDb = () => {
    const rawUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL;
    
    if (!rawUrl) {
        throw new Error("Database configuration missing. Please check POSTGRES_URL in your Vercel project settings.");
    }

    // Sanitize protocol for pg driver (Fixes 'protocol "prisma+postgres:" not supported' crash)
    const connectionString = rawUrl.replace('prisma+postgres://', 'postgres://');

    if (!globalPool) {
        globalPool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false }, // Required for Vercel/Neon/AWS Postgres
            max: 2, // Keep connection count low for serverless environments
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000, // Fail fast if DB is unreachable
        });
        
        // Handle pool errors to prevent process crash
        globalPool.on('error', (err) => {
            console.error('Unexpected DB Pool Error:', err);
        });
    }

    return {
        sql: async (strings: TemplateStringsArray, ...values: any[]) => {
            // Convert template literal (sql`...`) to parameterized query ($1, $2...)
            let text = strings[0];
            for (let i = 1; i < strings.length; i++) {
                text += '$' + i + strings[i];
            }
            
            try {
                // pg returns { rows: [], ... } which is compatible with the existing code structure
                return await globalPool!.query(text, values);
            } catch (error) {
                console.error("SQL Execution Error:", error);
                throw error;
            }
        }
    };
};