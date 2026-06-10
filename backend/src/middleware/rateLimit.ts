import { Request, Response, NextFunction } from 'express';
import { redis } from '../redis';
import { config } from '../config';

/**
 * RNF006 - Rate limiting do endpoint de geração de idKey:
 * no máximo N solicitações por e-mail a cada janela de tempo (padrão: 3 / 10min).
 *
 * Implementado com um contador no Redis e janela deslizante por chave.
 * Como o estado vive no Redis (compartilhado), múltiplas instâncias da API
 * respeitam o mesmo limite, mantendo-as stateless (RNF013).
 */
export async function rateLimitByEmail(req: Request, res: Response, next: NextFunction) {
  const email = (req.body?.email ?? '').toString().trim().toLowerCase();
  if (!email) {
    return next(); // validação de e-mail ocorre no handler da rota
  }

  const key = `ratelimit:idkey:${email}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, config.rateLimit.windowSeconds);
    }

    if (count > config.rateLimit.maxRequests) {
      const ttl = await redis.ttl(key);
      res.setHeader('Retry-After', String(Math.max(ttl, 0)));
      return res.status(429).json({
        error: 'rate_limited',
        message: `Limite de ${config.rateLimit.maxRequests} solicitações atingido. Tente novamente em ${Math.max(ttl, 0)}s.`,
      });
    }

    return next();
  } catch (err) {
    // Em caso de indisponibilidade do Redis, opta-se por não bloquear o fluxo.
    console.error('[rateLimit] Redis indisponível, liberando requisição:', (err as Error).message);
    return next();
  }
}
