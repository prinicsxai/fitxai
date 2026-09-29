# FITXAI - Sistema Profesional de Fichaje y Control Horario (100% Web)

Sistema empresarial completo de registro de jornada laboral, control horario y auditoría legal (cumplimiento estricto con el Art. 34.9 del Estatuto de los Trabajadores y el RGPD).

> **Arquitectura 100% Web Universal**: Toda la plataforma funciona exclusivamente mediante navegador web (HTML5, CSS3, JavaScript/TypeScript, React, Node.js, Express y PostgreSQL). No existen aplicaciones móviles nativas (sin Android nativo, sin iOS nativo, sin APKs ni IPAs). Funciona mediante una única URL adaptable a smartphones, tablets y ordenadores.

---

## 🏛️ 1. Arquitectura del Proyecto

```
FITXAI/
├── frontend/        # Aplicación Web Responsive Universal (React 18 + Vite + Tailwind CSS + PWA)
│   ├── src/components/WorkerView.tsx  # Portal Web del Trabajador (Mobile-First 360px-430px)
│   ├── src/components/DashboardView.tsx # Panel de Administración Web
│   ├── src/api/geolocation.ts        # Geolocalización Web puntual (HTML5 Geolocation API)
│   └── public/manifest.json          # Soporte PWA para "Añadir a pantalla de inicio"
├── backend/         # API RESTful empresarial (Node.js, Express, TypeScript, PG, SSE)
│   ├── src/controllers/              # Auth, Fichajes, Horarios, Incidencias, Reportes, Auditoría
│   ├── src/middlewares/              # Auth JWT, Roles, Rate Limiter, Sanitización XSS
│   └── src/services/                 # Realtime SSE, Generador de Reportes (CSV, Excel, PDF)
├── database/        # Migraciones DDL inmutables y seeds iniciales (PostgreSQL 14+)
│   ├── migrations/001_initial_schema.sql
│   └── seeds/initial_seed.sql
├── shared/          # Modelos, DTOs, Enums y contratos comunes TypeScript
├── tests/           # Suite de 98 pruebas automatizadas de integración, seguridad y E2E
├── docs/            # Documentación de arquitectura, privacidad y políticas legales
└── config/          # Plantillas de entorno (development, staging, production)
```

---

## 🔒 2. Política Estricta de GPS Web y Privacidad Laboral

1. **Sin Seguimiento Continuo**: No existe rastreo en segundo plano, ni monitorización continua de rutas.
2. **Activación Exclusivamente Puntual**: El navegador solicita la posición GPS mediante `navigator.geolocation.getCurrentPosition()` **únicamente** cuando el trabajador pulsa el botón:
   - `FICHAR ENTRADA`
   - `FICHAR SALIDA`
3. **Liberación Inmediata del Sensor**: En cuanto el navegador obtiene las coordenadas (latitud, longitud, precisión), el sensor se detiene y se libera de inmediato.
4. **Relación 1:1 Inmutable**: Cada registro de ubicación (`location_records`) está vinculado estrictamente a un único fichaje.
5. **Prevención de Suplantación (Anti-Mock)**: Se valida la precisión GPS (umbral máximo configurable por empresa, rechazo de coordenadas `0,0` o precisión inaceptable > 250m).

---

## 📱 3. Experiencia del Usuario según Rol y Dispositivo

Todo el sistema opera bajo una misma URL (por ejemplo: `https://fitxai.tudominio.com`):

### A. Para el Trabajador (Mobile-First en Smartphone o PC)
- **Navegadores soportados**: Safari en iOS (iPhone), Google Chrome en Android, Firefox, Edge, etc.
- **Acceso PWA**: Los trabajadores pueden usar "Añadir a la pantalla de inicio" para tener un acceso directo idéntico a una app sin ocupar almacenamiento ni requerir tiendas de aplicaciones.
- **Pantalla Principal**:
  - Saludo: *"Hola, [NOMBRE]"*.
  - Estados claros:
    - `NO HAS FICHADO`: Botón grande verde `FICHAR ENTRADA`.
    - `JORNADA ACTIVA`: Hora de entrada (`Entrada: 08:57`) y botón grande rojo `FICHAR SALIDA`.
    - `JORNADA FINALIZADA`: Resumen del turno (`Entrada: 08:57`, `Salida: 17:04`, `Horas: 08:07`).
- **Navegación Móvil (Pestañas inferiores)**:
  - **Inicio**: Fichar entrada/salida y estado actual.
  - **Mis fichajes**: Historial personal con hora, tipo y botón para ver el punto en el mapa.
  - **Mis horas**: Resumen de horas trabajadas hoy, en la semana y en el mes.
  - **Incidencias**: Notificar olvidos ("He olvidado fichar", "Problema GPS", etc.) y ver respuesta del admin.
  - **Mi perfil**: Datos del trabajador, puesto, departamento y botón para cerrar sesión.

### B. Para el Administrador (Desktop, Tablet o Móvil)
- **Dashboard en Tiempo Real**: Estadísticas en vivo conectadas por SSE (Server-Sent Events) sin recargar la página.
- **Gestión de Trabajadores**: Altas, bajas, reactivaciones y fichas completas.
- **Fichajes**: Filtros por fecha, trabajador y tipo; regularización auditada.
- **Mapa de Fichajes**: Puntos exactos de fichaje en mapa interactivo (OpenStreetMap / Leaflet).
- **Horarios**: Jornadas laborales, turnos y descansos.
- **Incidencias**: Aprobación o rechazo con comentarios que se auditan y actualizan el fichaje si procede.
- **Informes Legales**: Cómputo automático y exportaciones en CSV (UTF-8 con BOM), Excel (SpreadsheetXML) y PDF Oficial Art. 34.9 ET.
- **Auditoría**: Registro inmutable de cada acción con IP, usuario, timestamp y valores modificados.
- **Previsualización de Trabajador**: Botón integrado en la cabecera para alternar y probar la vista del trabajador directamente en el navegador.

---

## ⚙️ 4. Instalación y Dependencias

### Requisitos del Sistema
- **Node.js**: versión `>= 18.0.0`
- **npm**: versión `>= 9.0.0`
- **PostgreSQL**: versión `>= 14` (Recomendado PostgreSQL 16)

### Instalación del Monorepo
```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd FITXAI

# 2. Instalar dependencias completas
npm install

# 3. Compilar paquetes compartidos
npm run build:shared
```

---

## 🔐 5. Variables de Entorno

Crear el archivo `.env` en la raíz del proyecto a partir de la plantilla:
```bash
cp .env.example .env
```

Configuración requerida:
```env
# Configuración del Servidor Backend
PORT=4000
NODE_ENV=production
API_PREFIX=/api/v1
CORS_ORIGIN=https://fitxai.tudominio.com

# Base de Datos PostgreSQL
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/fitxai_prod?sslmode=prefer
DB_POOL_MAX=20
DB_TIMEOUT_MS=10000

# Seguridad y Autenticación
JWT_SECRET=super_secret_jwt_key_at_least_64_characters_long_for_security
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Geofencing y Tolerancia GPS
GPS_ACCURACY_THRESHOLD_METERS=150
GPS_MAX_ALLOWED_ACCURACY_METERS=250

# Frontend URL
VITE_API_URL=https://fitxai.tudominio.com/api/v1
```

---

## 🗄️ 6. Base de Datos y Migraciones

### Ejecutar Migración Inicial
```bash
psql -d fitxai_prod -f database/migrations/001_initial_schema.sql
```

### Cargar Datos Iniciales de Prueba (Opcional en Staging/Desarrollo)
```bash
psql -d fitxai_dev -f database/seeds/initial_seed.sql
```

Entidades gestionadas en PostgreSQL:
1. `companies`: Clientes multi-tenant aislados.
2. `users`: Administradores y trabajadores con roles y credenciales hash bcrypt.
3. `employees`: Ficha laboral detallada (código, puesto, departamento, fecha de alta).
4. `attendance_records`: Fichajes inmutables con fecha/hora oficial del servidor.
5. `location_records`: Coordenadas puntuales 1:1 asociadas al fichaje.
6. `work_schedules`: Horarios y turnos de trabajo.
7. `incidents`: Incidencias de fichaje y geolocalización.
8. `audit_logs`: Trazabilidad inmutable de todas las acciones.
9. `sessions`: Control de sesiones activas y revocación de tokens.
10. `devices`: Registro de navegadores/dispositivos web utilizados.
11. `settings`: Parámetros de tolerancia GPS y configuración de empresa.

---

## 👤 7. Creación de Empresa y Administrador Inicial

Para inicializar la primera empresa y el administrador sin dejar contraseñas en el código fuente, ejecuta:

```bash
# Modo interactivo en terminal:
npm run setup:admin

# O modo desatendido mediante variables de entorno:
INIT_COMPANY_NAME="Tech Logistics Iberia S.L." \
INIT_COMPANY_CIF="B87654321" \
INIT_ADMIN_EMAIL="admin@techlogistics.es" \
INIT_ADMIN_PASSWORD="AdminPasswordSegura123!" \
INIT_ADMIN_FIRST_NAME="Laura" \
INIT_ADMIN_LAST_NAME="García" \
npm run setup:admin
```

Credenciales de prueba generadas por el seed inicial:
- **Administrador**: `admin@techlogistics.es` / `Admin1234!`
- **Trabajador**: `marc.puig@techlogistics.es` / `Worker1234!`

---

## 🗺️ 8. Configuración del Proveedor de Mapas

El sistema utiliza **OpenStreetMap** y **Leaflet** por defecto, lo que garantiza:
- **Sin costes por petición ni API keys obligatorias**.
- **Inspección puntual**: Renderiza exclusivamente un marcador estático con la latitud y longitud del fichaje puntual.
- **Enlace directo opcional a Google Maps** para navegación en ruta externa si el administrador o trabajador lo desea.

---

## 🚀 9. Despliegue en Producción

### Compilación Completa
```bash
# Compila shared, backend y frontend en modo optimizado de producción
npm run build
```

### Ejecutar el Backend en Producción
Se recomienda el uso de **PM2** o **Docker**:
```bash
# Con PM2:
pm2 start backend/dist/server.js --name "fitxai-backend" -i max

# O directamente con Node:
npm run start:backend
```

### Despliegue del Frontend Web
El directorio compilado `frontend/dist/` contiene los archivos estáticos listos para ser servidos por **Nginx**, **Caddy** o **Cloudflare Pages**.

Ejemplo de configuración Nginx con HTTPS y proxy inverso:
```nginx
server {
    listen 80;
    server_name fitxai.tudominio.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name fitxai.tudominio.com;

    ssl_certificate /etc/letsencrypt/live/fitxai.tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fitxai.tudominio.com/privkey.pem;

    root /var/www/fitxai/frontend/dist;
    index index.html;

    # SPA Routing (cualquier ruta sirve el index.html de React)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy hacia el Backend Express
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Configuración para Server-Sent Events (SSE en vivo)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}
```

---

## 💾 10. Copias de Seguridad (Backups)

### Backup Completo de la Base de Datos
```bash
pg_dump -U postgres -d fitxai_prod -F c -b -v -f /backups/fitxai_$(date +%Y%m%d_%H%M%S).dump
```

### Restauración
```bash
pg_restore -U postgres -d fitxai_prod -v /backups/fitxai_20260929_220000.dump
```

---

## 🧪 11. Batería de Pruebas Automatizadas

El proyecto cuenta con **98 pruebas automáticas** que cubren el 100% de los flujos del sistema:

```bash
npm test
```

Suites incluidas:
- `tests/web_exclusive_architecture.test.js`: Verificación de ausencia de código nativo, endpoints web `/attendance/check-in`, `/attendance/check-out`, `/attendance/history` y `/audit-logs`.
- `tests/auth_multi_tenant.test.js`: Registro, login, recuperación, revocación de tokens y aislamiento estricto multi-empresa.
- `tests/real_punch_gps_flow.test.js`: Fichajes con GPS puntual, detección de Fake GPS y precisión.
- `tests/realtime_updates_flow.test.js`: Transmisión SSE en tiempo real para administradores.
- `tests/schedules_incidents_reports.test.js`: Motor de anomalías, cálculo de horas y exportación CSV/Excel/PDF.
- `tests/security_audit_privacy.test.js`: Inyecciones SQL, rate limiting, prevención de escalada de privilegios y trazabilidad de auditoría.
- `tests/production_e2e_and_error_handling.test.js`: 26 pasos de certificación de producción y pruebas de fallo (sin red, GPS degradado, doble clic rápido).

---

## ❓ 12. Solución de Problemas Frecuentes

1. **El trabajador ve "Permiso de ubicación denegado":**
   - El trabajador debe abrir los ajustes del navegador en su smartphone (Safari en iPhone -> Ajustes -> Safari -> Ubicación; o Chrome en Android -> Ajustes de sitio -> Ubicación), seleccionar "Permitir" y pulsar "Reintentar fichaje".
2. **Error de precisión GPS insuficiente (> 250m):**
   - El sistema avisa al trabajador de que la señal GPS es débil (por ejemplo, en un sótano o interior profundo). Se le sugiere acercarse a una ventana o activar el WiFi para mejorar la precisión satelital.
3. **No se ven actualizaciones en tiempo real en el Dashboard:**
   - Asegúrate de que el proxy inverso (Nginx) tiene `proxy_buffering off;` para permitir el flujo continuo de Server-Sent Events (SSE).

---

## ⚖️ 13. Cumplimiento Legal (España & UE)

- **Art. 34.9 Estatuto de los Trabajadores**: Registro de jornada diario con hora exacta de inicio y fin. Custodia legal durante 4 años de todos los datos inmutables y trazados.
- **RGPD / LOPDGDD**: Principio de minimización de datos. No se realiza ningún rastreo ni seguimiento de rutas, solo captura puntual obligatoria de geolocalización en el momento del fichaje con consentimiento y deber de información laboral.
