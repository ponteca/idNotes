import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from './pool';

// Executa o schema.sql de forma idempotente. Rode com `npm run migrate`
// (após o build) ou via docker-compose no boot do serviço de API.
async function migrate() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(sql);
  console.log('[migrate] schema aplicado com sucesso.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('[migrate] falha ao aplicar schema:', err);
  process.exit(1);
});
