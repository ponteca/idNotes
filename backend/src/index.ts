import fs from 'fs';
import http from 'http';
import https from 'https';
import { createApp } from './app';
import { config } from './config';

const app = createApp();

// RNF004 - quando TLS_ENABLED=true a API serve HTTPS diretamente (TLS 1.2+).
// Em produção típica, o TLS é terminado por um proxy reverso e a API roda
// em HTTP interno (config.tls.enabled=false, behindProxy=true).
if (config.tls.enabled) {
  const options = {
    key: fs.readFileSync(config.tls.keyPath),
    cert: fs.readFileSync(config.tls.certPath),
    minVersion: 'TLSv1.2' as const,
  };
  https.createServer(options, app).listen(config.port, () => {
    console.log(`[idnotes-backend] HTTPS ouvindo na porta ${config.port} (TLS 1.2+)`);
  });
} else {
  http.createServer(app).listen(config.port, () => {
    console.log(`[idnotes-backend] HTTP ouvindo na porta ${config.port} (TLS terminado por proxy)`);
  });
}
