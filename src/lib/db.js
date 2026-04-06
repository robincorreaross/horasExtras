import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
  max: 5,
  idle_timeout: 20,
});

export default sql;
