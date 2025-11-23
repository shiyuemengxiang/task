import pg from 'pg';
const { Pool } = pg;

// Global pool instance for singleton pattern across lambda invocations
let pool: pg.Pool | null = null;

// Helper to reconstruct SQL template literals for pg driver
// Matches the signature of @vercel/postgres db.sql: db.sql`SELECT * ...`
const sqlWrapper = (poolInstance: pg.Pool) => {
    return async (strings: TemplateStringsArray, ...values: any[]) => {
        let text = '';
        for (let i = 0; i < strings.length; i++) {
            text += strings[i];
            if (i < values.length) {
                text += `$${i + 1}`;
            }
        }
        return poolInstance.query(text, values);
    };
};

export const getDb = () => {
    if (pool) {
        return {
            sql: sqlWrapper(pool),
            pool
        };
    }

    let url = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL;

    console.log("DB Init [Native PG]:", {
        urlFound: !!url,
        urlPrefix: url ? url.split('://')[0] : 'none'
    });

    if (!url) {
        throw new Error("Database configuration missing. Please check POSTGRES_URL or DATABASE_URL in Vercel settings.");
    }

    // CRITICAL FIX: Replace prisma specific protocol which crashes standard drivers
    if (url.startsWith('prisma+postgres://')) {
        url = url.replace('prisma+postgres://', 'postgres://');
        console.log("Protocol fixed: prisma+postgres -> postgres");
    }

    try {
        pool = new Pool({
            connectionString: url,
            ssl: {
                rejectUnauthorized: false // Necessary for many Vercel/Neon/Supabase connections
            },
            connectionTimeoutMillis: 5000, // Fail fast (5s) instead of hanging
            idleTimeoutMillis: 10000, // Close idle clients quickly in serverless
            max: 2 // Low max connections for serverless
        });

        pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
            // Don't exit, just log. Vercel will recycle the container eventually.
        });

        return {
            sql: sqlWrapper(pool),
            pool
        };
    } catch (e) {
        console.error("Failed to initialize PG Pool:", e);
        throw e;
    }
};