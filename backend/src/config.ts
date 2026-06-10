import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '8443', 10),

  // RNF004 - HTTPS/TLS. Em produção o TLS pode ser terminado por um proxy
  // (NGINX/Traefik). Quando TLS_ENABLED=true, a API sobe direto em HTTPS.
  tls: {
    enabled: (process.env.TLS_ENABLED ?? 'false') === 'true',
    keyPath: process.env.TLS_KEY_PATH ?? './certs/key.pem',
    certPath: process.env.TLS_CERT_PATH ?? './certs/cert.pem',
    // Quando atrás de proxy TLS, força HTTPS via cabeçalho X-Forwarded-Proto.
    behindProxy: (process.env.TLS_BEHIND_PROXY ?? 'true') === 'true',
  },

  database: {
    url: required('DATABASE_URL', 'postgres://idnotes:idnotes@localhost:5432/idnotes'),
  },

  redis: {
    url: required('REDIS_URL', 'redis://localhost:6379'),
  },

  // RNF001 - segredo do servidor para o HMAC-SHA256 da idKey.
  idKey: {
    hmacSecret: required('IDKEY_HMAC_SECRET', 'troque-este-segredo-em-producao'),
    // RNF005 - custo do bcrypt para o hash persistido.
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  },

  jwt: {
    secret: required('JWT_SECRET', 'troque-este-jwt-em-producao'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  },

  // RNF006 - rate limiting: 3 solicitações por e-mail a cada 10 minutos.
  rateLimit: {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX ?? '3', 10),
    windowSeconds: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS ?? '600', 10),
  },
};
