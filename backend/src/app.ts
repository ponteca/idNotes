import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { config } from './config';
import idkeyRoutes from './routes/idkey';

export function createApp() {
  const app = express();

  // Necessário para ler X-Forwarded-Proto quando atrás de proxy TLS.
  app.set('trust proxy', true);

  // RNF004 - cabeçalhos de segurança, incluindo HSTS (força HTTPS no cliente).
  app.use(
    helmet({
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
    })
  );

  // RNF004 - rejeita requisições em HTTP quando há terminação TLS por proxy.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (config.env === 'production' && config.tls.behindProxy) {
      const proto = req.header('x-forwarded-proto');
      if (proto && proto !== 'https') {
        return res.status(426).json({ error: 'https_required', message: 'Use HTTPS/TLS 1.2+.' });
      }
    }
    next();
  });

  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/idkey', idkeyRoutes);

  // 404
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

  // Handler de erro genérico
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[app] erro não tratado:', err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
