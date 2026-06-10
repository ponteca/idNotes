# idNotes — Backend

API **stateless** de geração e validação da **idKey**, atendendo aos requisitos
não funcionais de backend da especificação (LTP IV).

| Req | Onde é atendido |
|-----|-----------------|
| **RNF004** — HTTPS/TLS 1.2+ | `helmet` + HSTS, bloqueio de HTTP atrás de proxy (`app.ts`) e modo HTTPS direto com `minVersion: TLSv1.2` (`index.ts`) |
| **RNF005** — idKey só como hash | `bcrypt` no `services/idkey.ts`; coluna `idkey_hash` (`db/schema.sql`) — texto claro nunca é persistido |
| **RNF006** — rate limiting (3 / 10 min por e-mail) | `middleware/rateLimit.ts` usando Redis |
| **RNF013** — stateless + containerizado | `Dockerfile` + `docker-compose.yml` (API + PostgreSQL + Redis) |
| RNF001 — idKey via HMAC-SHA256 | `services/idkey.ts` (`generateIdKey`) |

> Observação: o app móvel (RF001–RF006) ainda não consome esta API — a
> integração no cliente foi deixada de fora deste escopo. Os endpoints abaixo
> já estão prontos para quando essa integração for feita.

## Stack
- Node.js 20 + TypeScript + Express
- PostgreSQL 16 (persistência)
- Redis 7 (rate limiting)

## Endpoints

### `POST /api/idkey/request`
Gera a idKey e envia por e-mail. Persiste apenas o hash. Rate limited.
```json
// req
{ "email": "user@exemplo.com" }
// res 202
{ "message": "Se o e-mail for válido, a idKey será enviada em instantes." }
```

### `POST /api/idkey/verify`
Valida a idKey e devolve um JWT de sessão.
```json
// req
{ "email": "user@exemplo.com", "idKey": "IDK-7QF3-9XK2-..." }
// res 200
{ "token": "<jwt>" }
```

### `GET /health`
Healthcheck simples.

## Como rodar

### Com Docker (recomendado — RNF013)
```bash
cd backend
cp .env.example .env   # ajuste os segredos
docker compose up --build
```
Sobe API (`:8443`), PostgreSQL e Redis. O schema é aplicado automaticamente.

### Local (sem Docker)
Requer PostgreSQL e Redis acessíveis (ajuste `DATABASE_URL`/`REDIS_URL` no `.env`).
```bash
cd backend
npm install
npm run build
npm run migrate   # cria a tabela users
npm start         # ou: npm run dev
```

## HTTPS/TLS (RNF004)
Dois modos:
1. **TLS por proxy reverso (padrão)** — NGINX/Traefik termina o TLS e encaminha
   para a API em HTTP interno. Mantenha `TLS_ENABLED=false` e
   `TLS_BEHIND_PROXY=true`: em produção, requisições sem `X-Forwarded-Proto: https`
   são rejeitadas com `426 Upgrade Required`.
2. **HTTPS direto** — defina `TLS_ENABLED=true` e aponte `TLS_KEY_PATH`/`TLS_CERT_PATH`
   para os certificados. Para testes locais, gere um par autoassinado:
   ```bash
   mkdir -p certs
   openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
     -keyout certs/key.pem -out certs/cert.pem -subj "/CN=localhost"
   ```

## Segurança
- A idKey em texto claro só trafega no e-mail; nunca é gravada nem retornada nas respostas (RNF005).
- Troque `IDKEY_HMAC_SECRET` e `JWT_SECRET` por valores fortes em produção.
- Respostas de autenticação são genéricas para não revelar existência de e-mail.
