import { Pool } from 'pg';
import { config } from '../config';

// Pool de conexões PostgreSQL. A API permanece stateless (RNF013):
// todo o estado persistente vive no Postgres, e o efêmero no Redis.
export const pool = new Pool({ connectionString: config.database.url });

pool.on('error', (err) => {
  console.error('[postgres] erro inesperado no pool de conexões:', err);
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}
