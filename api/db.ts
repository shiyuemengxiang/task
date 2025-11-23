import { Pool } from 'pg';

let pool: Pool | null = null;

/**
 * Helper to convert template literal arguments to Postgres parameterized query
 * e.g. sql`SELECT * FROM users WHERE id = ${id}` 
 * becomes text: "SELECT * FROM users WHERE id = $1", values: [id]
 */
const createQuery = (strings: TemplateStringsArray, values: any[]) => {
    let text = '';
    for (let i = 0; i < strings.length; i++) {
        text += strings[i];
        if (i < values.length) {
            text += `$${i + 1}`;
        }
    }
    return { text, values };
};

export const getDb = () => {
    // Lazy initialization wrapper
    // This prevents the function from crashing during module load if env vars are missing,
    // and allows the error to be caught inside the specific API handler (e.g. health check).
    
    const initPool = () => {
        if (pool) return pool;
        
        let connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL || '';
        
        // CRITICAL FIX: Replace 'prisma+postgres://' with 'postgres://' to support standard drivers
        if (connectionString.startsWith('prisma+postgres://')) {
            connectionString = connectionString.replace('prisma+postgres://', 'postgres://');
        }
        
        if (!connectionString) {
            throw new Error("Database configuration missing. Please check POSTGRES_URL in Vercel settings.");
        }

        // Initialize standard PG Pool
        pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false }, // Required for Vercel Postgres / Neon
            max: 1, // Limit connections for serverless
            connectionTimeoutMillis: 15000, // Allow time for cold boot
            idleTimeoutMillis: 30000
        });
        
        pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
            // Do not exit process
        });

        return pool;
    };

    return {
        sql: async (strings: TemplateStringsArray, ...values: any[]) => {
            const p = initPool();
            const { text, values: params } = createQuery(strings, values);
            // Return standard pg result. The calling code expects { rows: [...] } which pg provides.
            return await p.query(text, params);
        }
    };
};