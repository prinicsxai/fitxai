FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm ci

# Copiar código fuente
COPY tsconfig.json ./
COPY shared ./shared
COPY backend ./backend
COPY frontend ./frontend

# Compilar todos los paquetes
RUN npm run build

# Etapa final de producción
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm ci --omit=dev

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY database/migrations ./database/migrations

EXPOSE 4000

CMD ["node", "backend/dist/server.js"]
