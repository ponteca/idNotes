import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';
import { config } from '../config';
import { generateIdKey, hashIdKey, verifyIdKey } from '../services/idkey';
import { sendIdKeyEmail } from '../services/email';
import { rateLimitByEmail } from '../middleware/rateLimit';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UserRow {
  id: string;
  email: string;
  idkey_hash: string;
}

/**
 * RF001/RF002/RF006 - Solicitação de idKey.
 * POST /api/idkey/request  { email }
 * Gera a idKey (HMAC-SHA256), persiste somente o hash (RNF005) e dispara o
 * e-mail transacional. Protegido por rate limiting (RNF006).
 */
router.post('/request', rateLimitByEmail, async (req: Request, res: Response) => {
  const email = (req.body?.email ?? '').toString().trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'invalid_email', message: 'E-mail inválido.' });
  }

  try {
    const idKey = generateIdKey(email);
    const idkeyHash = await hashIdKey(idKey);

    // upsert: cada nova solicitação substitui o hash anterior do e-mail.
    await query(
      `INSERT INTO users (email, idkey_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET idkey_hash = EXCLUDED.idkey_hash`,
      [email, idkeyHash]
    );

    await sendIdKeyEmail(email, idKey);

    // A idKey em texto claro só trafega via e-mail; a resposta não a expõe.
    return res.status(202).json({
      message: 'Se o e-mail for válido, a idKey será enviada em instantes.',
    });
  } catch (err) {
    console.error('[idkey/request] erro:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Falha ao gerar a idKey.' });
  }
});

/**
 * RF003 - Autenticação por idKey.
 * POST /api/idkey/verify  { email, idKey }
 * Valida a idKey contra o hash bcrypt e devolve um JWT de sessão (RF004 no app).
 */
router.post('/verify', async (req: Request, res: Response) => {
  const email = (req.body?.email ?? '').toString().trim().toLowerCase();
  const idKey = (req.body?.idKey ?? '').toString().trim();

  if (!EMAIL_RE.test(email) || !idKey) {
    return res.status(400).json({ error: 'invalid_input', message: 'E-mail e idKey são obrigatórios.' });
  }

  try {
    const rows = await query<UserRow>('SELECT id, email, idkey_hash FROM users WHERE email = $1', [email]);
    const user = rows[0];

    // Resposta genérica para não revelar se o e-mail existe.
    const ok = user ? await verifyIdKey(idKey, user.idkey_hash) : false;
    if (!ok || !user) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'idKey inválida.' });
    }

    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

    const token = jwt.sign({ sub: user.id, email: user.email }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    return res.status(200).json({ token });
  } catch (err) {
    console.error('[idkey/verify] erro:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Falha ao validar a idKey.' });
  }
});

export default router;
