# FITXAI - Sistema Profesional de Fichaje y Control Horario

Sistema escalable y empresarial de registro de jornada laboral, diseñado con una arquitectura modular, alta seguridad y respeto absoluto a la privacidad del trabajador.

---

## 🏛️ Estructura del Proyecto

```
FITXAI/
├── frontend/        # Panel Web para Administradores / Jefes (React 18 + Vite + Tailwind)
├── mobile/          # Aplicación Móvil para Trabajadores (React Native / Expo - Android & iOS)
├── backend/         # API RESTful con alta seguridad (Node.js, Express, TypeScript, PG)
├── database/        # Migraciones DDL, esquemas Prisma y seeds iniciales (PostgreSQL 16)
├── shared/          # Modelos, DTOs, Enums y contratos comunes TypeScript
├── tests/           # Pruebas automatizadas de integración y base de datos
├── docs/            # Arquitectura, API, políticas GPS y diccionario de entidades
└── config/          # Plantillas de entorno (development, staging, production)
```

---

## 🔒 Política Estricta de GPS (Privacidad Laboral)

- **El GPS se activa ÚNICAMENTE en el instante exacto en que el trabajador presiona "Fichar Entrada" o "Fichar Salida".**
- En cuanto se obtienen las coordenadas y su precisión, **el sensor se desactiva y se libera de inmediato**.
- 🚫 **Sin tracking continuo ni rastreo de rutas**.
- 🚫 **Sin geolocalización en segundo plano**.
- 🚫 **Sin lecturas periódicas durante la jornada laboral**.
- Cada registro de localización (`location_records`) está vinculado estrictamente 1:1 a un fichaje puntual.

---

## 🚀 Puesta en Marcha Rápida

### 1. Requisitos Previos
- **Node.js** >= 18
- **PostgreSQL** >= 14 (o PostgreSQL 16 instalado localmente o mediante Docker)

### 2. Configurar Base de Datos y Entorno
```bash
# Copiar variables de entorno
cp .env.example .env

# Ejecutar migración y seed en PostgreSQL
psql -d fitxai_dev -f database/migrations/001_initial_schema.sql
psql -d fitxai_dev -f database/seeds/initial_seed.sql
```

### 3. Instalar Dependencias y Compilar Tipos
```bash
npm install
npm run build:shared
```

### 4. Crear el Administrador Inicial (Sin credenciales en código)
Puedes ejecutar el asistente interactivo en terminal:
```bash
npm run setup:admin
```
O de forma desatendida mediante variables de entorno:
```bash
INIT_COMPANY_NAME="Mi Empresa S.L." \
INIT_COMPANY_CIF="B-12345678" \
INIT_ADMIN_EMAIL="admin@miempresa.com" \
INIT_ADMIN_PASSWORD="MiPasswordSegura123!" \
INIT_ADMIN_FIRST_NAME="Laura" \
INIT_ADMIN_LAST_NAME="García" \
npm run setup:admin
```

### 5. Ejecución en Desarrollo
- **Backend API**:
  ```bash
  npm run dev:backend
  # Escuchando en http://localhost:4000 (Health en http://localhost:4000/api/v1/health)
  ```

- **Panel Web Frontend (Administrador)**:
  ```bash
  npm run dev:frontend
  # Disponible en http://localhost:5173
  ```

- **Aplicación Móvil (Trabajador)**:
  ```bash
  npm run dev:mobile
  # Inicia el entorno Expo para Android, iOS y Web móvil
  ```

### 5. Ejecutar Pruebas Automatizadas
```bash
npm test
```

---

## 👥 Credenciales de Prueba (Seeds)
- **Administrador**: `admin@techlogistics.es` / `Admin1234!`
- **Trabajador**: `carlos.garcia@techlogistics.es` / `Admin1234!`
