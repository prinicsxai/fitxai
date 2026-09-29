# FITXAI - Diccionario de Datos y Modelo Relacional

El sistema cuenta con 11 entidades relacionales normalizadas para soportar el ciclo de vida completo de empresas, empleados, fichajes, auditoría y seguridad.

---

## 1. Entidades Principales

### 1. `companies`
Representa a la empresa u organización cliente.
- `id`: UUID (Clave primaria).
- `name`: Razón social.
- `cif`: Identificador fiscal (Único).
- `address`, `contact_email`, `contact_phone`.
- `timezone`: Zona horaria oficial para el cálculo de jornadas (ej. `'Europe/Madrid'`).
- `is_active`: Estado de la empresa.

### 2. `users`
Cuentas de acceso y credenciales seguras.
- `id`: UUID (Clave primaria).
- `company_id`: FK a `companies`.
- `email`: Correo electrónico corporativo (Único).
- `password_hash`: Hash Bcrypt/Argon2.
- `role`: Enum (`ADMIN`, `EMPLOYEE`, `MANAGER`).
- `status`: Enum (`ACTIVE`, `INACTIVE`, `SUSPENDED`).
- `last_login_at`: Timestamp del último inicio de sesión.

### 3. `employees`
Ficha laboral y profesional del trabajador.
- `id`: UUID (Clave primaria).
- `user_id`: FK a `users` (1:1).
- `company_id`: FK a `companies`.
- `first_name`, `last_name`: Nombre y apellidos.
- `document_id`: DNI / NIE / Pasaporte.
- `employee_code`: Código de empleado asignado.
- `department`, `job_title`: Departamento y puesto.
- `hire_date`: Fecha de contratación.

### 4. `attendance_records`
Fichajes de entrada y salida puntuales.
- `id`: UUID (Clave primaria).
- `employee_id`: FK a `employees`.
- `company_id`: FK a `companies`.
- `type`: Enum (`CHECK_IN`, `CHECK_OUT`).
- `timestamp`: Fecha y hora exacta del servidor en el momento de la confirmación.
- `status`: Enum (`VERIFIED`, `FLAGGED`, `REJECTED`).
- `device_id`: Dispositivo origen (opcional).
- `notes`: Observaciones del fichaje.

### 5. `location_records`
Ubicación puntual del fichaje.
- `id`: UUID (Clave primaria).
- `attendance_record_id`: FK a `attendance_records` (**UNIQUE**, relación 1:1 estricta).
- `latitude`, `longitude`: Coordenadas geográficas decimales WGS84.
- `accuracy`: Radio de precisión GPS en metros reportado por el hardware.
- `altitude`: Altitud sobre el nivel del mar (opcional).
- `captured_at`: Instante exacto de captura del sensor GPS.
- `provider`: Proveedor de señal (`gps`, `fused`, etc.).
- `is_mocked`: Bandera booleana si se detecta simulación de GPS.

### 6. `devices`
Dispositivos móviles autorizados o registrados.
- `id`: UUID (Clave primaria).
- `user_id`: FK a `users`.
- `device_fingerprint`: Hash identificador único del hardware/instalación.
- `platform`: `'android'` | `'ios'` | `'web'`.
- `os_version`, `app_version`, `device_name`.
- `is_trusted`: Bandera de confianza para prevenir suplantaciones.

### 7. `sessions`
Sesiones activas y tokens emitidos.
- `id`: UUID.
- `user_id`: FK a `users`.
- `token_hash`: Hash SHA-256 del token para permitir revocación inmediata.
- `ip_address`, `user_agent`.
- `expires_at`, `revoked_at`.

### 8. `incidents`
Alertas e inconsistencias detectadas en fichajes (ej. baja precisión GPS, fuera de rango).
- `id`: UUID.
- `company_id`, `employee_id`, `attendance_record_id`.
- `type`: Tipo de incidencia (ej. `LOW_GPS_ACCURACY`).
- `severity`: Enum (`LOW`, `MEDIUM`, `HIGH`).
- `description`: Detalle del problema.
- `status`: Enum (`PENDING`, `REVIEWED`, `RESOLVED`, `DISMISSED`).

### 9. `audit_logs`
Trazabilidad inmutable de acciones en el sistema.
- `id`: UUID.
- `company_id`, `user_id`.
- `action`: Acción realizada (ej. `USER_LOGIN`, `PUNCH_CHECK_IN`).
- `entity_type`, `entity_id`.
- `ip_address`, `metadata` (JSONB).

### 10. `notifications`
Centro de notificaciones para usuarios.
- `id`: UUID.
- `user_id`: FK a `users`.
- `title`, `message`.
- `type`: Enum (`INFO`, `WARNING`, `ALERT`).
- `is_read`: Estado de lectura.

### 11. `settings`
Configuraciones y políticas parametrizables por empresa.
- `id`: UUID.
- `company_id`: FK a `companies` (Nullable para ajustes de plataforma).
- `key`: Clave de configuración (ej. `gps_accuracy_threshold_meters`).
- `value`: Valor configurado.
