import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgres://postgres.vfpgqqfqoxfzwigntcua:BD%40163517bd%40@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';

const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
  max: 5,
  idle_timeout: 20,
});

export default sql;
