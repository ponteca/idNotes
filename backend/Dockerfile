# RNF013 - Imagem stateless da API, multi-stage para imagem final enxuta.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
# O build (tsc) já copia o schema.sql para dist/db (ver package.json).
RUN npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 8443
# Aplica o schema (idempotente) e sobe a API.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
