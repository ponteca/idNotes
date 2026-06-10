import Redis from 'ioredis';
import { config } from './config';

// Redis é usado apenas como cache efêmero (rate limiting). A API continua
// stateless: nenhuma sessão de usuário é guardada aqui (RNF013).
export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 2,
  lazyConnect: false,
});

redis.on('error', (err) => {
  console.error('[redis] erro de conexão:', err.message);
});
