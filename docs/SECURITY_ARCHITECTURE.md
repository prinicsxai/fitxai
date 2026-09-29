# ARQUITECTURA DE SEGURIDAD, AUDITORÍA Y CONTROL DE ACCESO - FITXAI

**Estado:** Producción / Empresa  
**Nivel de Seguridad:** Grado Empresarial (Compliance RGPD / Art. 34.9 ET / Esquema Nacional de Seguridad)

---

## 1. RESUMEN EJECUTIVO DE SEGURIDAD

FITXAI implementa una estrategia de **Defensa en Profundidad** (*Defense in Depth*) que abarca todas las capas de la aplicación: red, transporte, aplicación, control de sesiones, base de datos y auditoría inmutable.

```
[ Cliente Móvil / Web Admin ]
             │
             ▼ (TLS 1.3 / HTTPS Obligatorio con HSTS)
[ Capa de Red & Reverse Proxy ] (Helmet, CORS Whitelist, Rate Limiting)
             │
             ▼ (Bearer JWT + Verificación de Sesión Activa en DB)
[ API Gateway & Middlewares ] (Sanitización XSS, Aislamiento Multi-Tenant, RBAC)
             │
             ▼ (Consultas 100% Parametrizadas contra SQL Injection)
[ Base de Datos PostgreSQL ] (Aislamiento por Company_ID, Row-Level Segregation)
             │
             ▼
[ Registro Inmutable de Auditoría ] (audit_logs: 10 eventos críticos con IP, actor y diff)
```

---

## 2. CIFRADO Y SEGURIDAD EN TRÁNSITO (HTTPS / TLS)

1. **Protocolo:** Exclusivamente **TLS 1.3** (y TLS 1.2 como fallback mínimo). Protocolos obsoletos (SSLv3, TLS 1.0, TLS 1.1) están desactivados en los balanceadores y proxies de terminación.
2. **HSTS (HTTP Strict Transport Security):** La cabecera `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` instruye a los navegadores a denegar de inmediato conexiones HTTP inseguras.
3. **Cabeceras HTTP de Seguridad (Helmet):**
   - `Content-Security-Policy (CSP)`: Restringe la carga de scripts externos y fuentes a orígenes confiables autorizados.
   - `X-Content-Type-Options: nosniff`: Previene ataques de MIME-type sniffing.
   - `X-Frame-Options: DENY`: Previene ataques de clickjacking.
   - `Referrer-Policy: strict-origin-when-cross-origin`.
   - `Cross-Origin-Resource-Policy: cross-origin`.

---

## 3. GESTIÓN DE AUTENTICACIÓN, HASHING Y SESIONES

### 3.1. Almacenamiento Seguro de Contraseñas
- Las contraseñas **nunca se almacenan en texto plano**.
- Se utiliza el algoritmo **bcrypt** con un coste de cómputo (*salt rounds*) de **10** (o superior), diseñado contra ataques de diccionario y hardware GPU distribuido.

### 3.2. Tokens de Acceso y Revocación de Sesiones en Base de Datos
- **Formato:** JSON Web Tokens (JWT) firmados con secreto criptográfico de 256 bits (`JWT_SECRET`).
- **Tiempo de vida limitado:** Por defecto 8 horas (`JWT_EXPIRATION`), obligando a reautenticación tras la jornada laboral.
- **Doble Factor de Sesión (Stateful Session Invalidation):**
  - Cada vez que un usuario inicia sesión, se genera un hash criptográfico SHA-256 del token (`token_hash`) que se almacena en la tabla `sessions`.
  - En cada petición HTTP entrante, el middleware `requireAuth` comprueba que la sesión no haya sido **revocada** (`revoked_at IS NULL`) ni haya **expirado** (`expires_at > NOW()`).
  - Al realizar **Logout**, **Cambio de Contraseña** o **Desactivación del Trabajador**, la sesión queda invalidada en base de datos de inmediato.

---

## 4. PROTECCIÓN CONTRA ATAQUES COMUNES

### 4.1. Fuerza Bruta (Brute-Force Attack Prevention)
- **`authRateLimiter`:** En los endpoints `/api/v1/auth/login`, `/forgot-password` y `/reset-password`, se impone un límite estricto de **15 intentos cada 15 minutos por dirección IP**. Una vez superado el umbral, el servidor responde con código HTTP `429 Too Many Requests`.
- **`globalRateLimiter`:** Un límite global de **500 peticiones cada 15 minutos por IP** previene ataques de denegación de servicio (DoS) a nivel de aplicación.

### 4.2. Inyección SQL (SQL Injection Prevention)
- Todas las consultas a la base de datos PostgreSQL se ejecutan a través de **sentencias preparadas y consultas parametrizadas** (`$1, $2, $3...`) mediante el driver oficial `pg`.
- **Prohibición absoluta:** En ningún caso se realiza concatenación o interpolación de cadenas de texto en las cláusulas SQL (`WHERE`, `ORDER BY`, etc.).

### 4.3. Cross-Site Scripting (XSS)
- Middleware `sanitizeInputMiddleware`: Aplica una limpieza recursiva sobre todos los campos de texto del cuerpo de las peticiones (`req.body`), eliminando etiquetas maliciosas `<script>`, controladores de eventos HTML inline (`onerror=`, `onload=`) y esquemas peligrosos (`javascript:`).
- En el frontend de React, todas las salidas de datos se escapan automáticamente en el Virtual DOM contra inyecciones contextuales.

### 4.4. Cross-Site Request Forgery (CSRF)
- FITXAI utiliza una arquitectura de API REST desacoplada que autentica mediante la cabecera HTTP `Authorization: Bearer <token>`.
- Al no emplear cookies de sesión pasivas que el navegador envíe de forma automática en peticiones entre sitios (*cross-site*), el sistema es inmune a ataques CSRF convencionales.
- Se implementa verificación estricta de orígenes permitidos en la capa CORS.

### 4.5. Configuración de CORS
- Los orígenes permitidos se definen en la variable de entorno `CORS_ORIGIN` (ej. `https://app.fitxai.es,https://admin.fitxai.es`).
- Se configuran preflights HTTP OPTIONS con cacheo de 24 horas (`maxAge: 86400`) y cabeceras permitidas explícitas: `['Content-Type', 'Authorization', 'X-Requested-With', 'X-Device-Id']`.

---

## 5. CONTROL DE ACCESO BASADO EN ROLES (RBAC) Y AISLAMIENTO MULTI-TENANT

### 5.1. Matriz de Permisos

| Recurso / Endpoint | ADMIN | MANAGER | EMPLOYEE (Trabajador) |
| :--- | :---: | :---: | :---: |
| **Fichar Entrada / Salida con GPS** | ✅ | ✅ | ✅ (Sólo su propia ficha) |
| **Consultar su propio estado de jornada** | ✅ | ✅ | ✅ |
| **Historial "Mis Fichajes"** | ✅ | ✅ | ✅ (Exclusivamente los propios) |
| **Crear incidencia personal** | ✅ | ✅ | ✅ |
| **Ver fichajes de otros trabajadores** | ✅ (Misma empresa) | ✅ (Misma empresa) | ❌ **BLOQUEADO (403)** |
| **Crear / Editar / Desactivar empleados** | ✅ | ❌ | ❌ **BLOQUEADO (403)** |
| **Configurar Horarios de la empresa** | ✅ | ❌ | ❌ **BLOQUEADO (403)** |
| **Aprobar / Rechazar Incidencias** | ✅ | ✅ (Revisión) | ❌ **BLOQUEADO (403)** |
| **Corregir Fichajes con Auditoría** | ✅ | ❌ | ❌ **BLOQUEADO (403)** |
| **Consultar Informes y Exportar (CSV/XLS/PDF)** | ✅ | ✅ | ❌ **BLOQUEADO (403)** |
| **Consultar Registros de Auditoría (`audit_logs`)**| ✅ | ✅ | ❌ **BLOQUEADO (403)** |
| **Modificar Configuración de la Empresa** | ✅ | ❌ | ❌ **BLOQUEADO (403)** |

### 5.2. Aislamiento Multi-Tenant Absoluto
- En todas las tablas de negocio (`employees`, `attendance_records`, `work_schedules`, `incidents`, `audit_logs`, `settings`), existe una columna obligatoria `company_id`.
- **Regla del Backend:** El `company_id` **nunca se toma de los parámetros enviados por el cliente**. Se extrae directamente del token JWT verificado en el servidor y validado contra el registro del usuario en la base de datos (`req.user.companyId`).
- Si un Administrador de la Empresa A intenta acceder o modificar un registro con un ID perteneciente a la Empresa B, la consulta devuelve automáticamente `404 Not Found` o `403 Forbidden`.

---

## 6. REGISTRO INMUTABLE DE AUDITORÍA

Conforme a los requerimientos de seguridad e inspección laboral, FITXAI registra de forma persistente e inalterable en la tabla `audit_logs` los **10 eventos empresariales críticos**:

1. `USER_LOGIN`: Inicio de sesión (con IP, navegador/dispositivo y timestamp).
2. `USER_LOGOUT`: Cierre de sesión y revocación del token de acceso.
3. `EMPLOYEE_CREATED`: Alta de nuevo trabajador en la empresa.
4. `EMPLOYEE_UPDATED`: Modificación de datos personales, departamento o puesto.
5. `EMPLOYEE_DEACTIVATED`: Baja/desactivación del empleado y revocación de todas sus sesiones activas.
6. `PUNCH_CHECK_IN` / `PUNCH_CHECK_OUT`: Fichaje de jornada con coordenadas, precisión y dispositivo.
7. `PUNCH_CORRECTED`: Modificación administrativa de un fichaje con motivo justificado y valores antes/después.
8. `INCIDENT_APPROVED`: Aprobación de incidencia y regularización automática de fichajes olvidados.
9. `INCIDENT_REJECTED`: Rechazo motivado de incidencias.
10. `SETTINGS_UPDATED`: Modificación de umbrales GPS, zona horaria o políticas de fichaje.

### Campos Almacenados en Cada Entrada de Auditoría
- `id`: Identificador único UUIDv4.
- `company_id`: Empresa a la que pertenece el registro (aislamiento estricto).
- `user_id`: Identificador del usuario que ejecutó la acción.
- `action`: Nombre del evento auditado.
- `entity_type`: Tabla o recurso afectado (`users`, `employees`, `attendance_records`, etc.).
- `entity_id`: Identificador del registro modificado.
- `ip_address`: Dirección IP origen de la petición.
- `metadata`: Objeto JSON con los valores anteriores (`before`), posteriores (`after`), motivos justificativos y huella digital del dispositivo.
- `created_at`: Fecha y hora oficial del servidor de base de datos (`CURRENT_TIMESTAMP`).

---

## 7. GESTIÓN DE SECRETOS Y VARIABLES DE ENTORNO

- Ninguna contraseña, hash o clave de API se encuentra codificada de forma estática en el código fuente (*hardcoded*).
- Toda la configuración sensible reside en archivos `.env` excluidos del control de versiones (`.gitignore`).
- **Salvaguarda de Inicio en Producción:** El módulo [`backend/src/config/env.ts`](file:///Users/dpeixotoc/Desktop/FITXAI/backend/src/config/env.ts) comprueba al arrancar que en entorno `production` la variable `JWT_SECRET` no contenga valores de desarrollo (`dev-insecure`). Si detecta una clave insegura, el proceso aborta inmediatamente con excepción crítica.
