# FITXAI - Especificación de Endpoints API v1

Base URL: `http://localhost:4000/api/v1`

---

## 1. Verificación de Salud
### `GET /health`
Verifica la disponibilidad del servidor y la conexión a la base de datos PostgreSQL.
- **Autenticación**: Pública.

---

## 2. Autenticación y Sesiones Seguras

### `POST /auth/login`
Inicio de sesión con rate-limiting y emisión de JWT con ID único de sesión (`jti`).
- **Autenticación**: Pública (Protegida por rate limiting anti-fuerza bruta).
- **Body**:
```json
{
  "email": "carlos.garcia@techlogistics.es",
  "password": "Admin1234!",
  "platform": "android"
}
```

### `POST /auth/logout`
Revoca la sesión activa en base de datos.
- **Autenticación**: Bearer JWT.

### `POST /auth/forgot-password`
Genera un token seguro con expiración de 1 hora para recuperación de clave.
- **Autenticación**: Pública.
- **Body**:
```json
{
  "email": "carlos.garcia@techlogistics.es"
}
```

### `POST /auth/reset-password`
Restablece la contraseña validando el token criptográfico y revoca sesiones anteriores.
- **Autenticación**: Pública.
- **Body**:
```json
{
  "token": "token-recibido",
  "newPassword": "NuevaPassword2026!"
}
```

### `POST /auth/change-password`
Permite a un usuario autenticado cambiar su contraseña actual.
- **Autenticación**: Bearer JWT.
- **Body**:
```json
{
  "currentPassword": "Admin1234!",
  "newPassword": "NuevaPassword2026!"
}
```

---

## 3. Usuarios

### `GET /users/me`
Obtiene los datos completos del usuario autenticado y su perfil laboral de empleado (si aplica).
- **Autenticación**: Bearer JWT.
- **Respuesta 200 OK**:
```json
{
  "success": true,
  "data": {
    "id": "u-uuid",
    "email": "carlos.garcia@techlogistics.es",
    "firstName": "Carlos",
    "lastName": "García Moreno",
    "phone": "+34 600 000 000",
    "role": "EMPLOYEE",
    "status": "ACTIVE",
    "company": {
      "id": "c-uuid",
      "name": "Tech Logistics Iberia S.L.",
      "cif": "B-12345678",
      "timezone": "Europe/Madrid"
    },
    "createdAt": "2026-09-29T20:49:40.000Z",
    "lastLoginAt": "2026-09-29T22:55:00.000Z",
    "employeeProfile": {
      "id": "e-uuid",
      "documentId": "48765432X",
      "employeeCode": "EMP-0042",
      "department": "Operaciones",
      "jobTitle": "Técnico de Campo",
      "schedule": "Lunes a Viernes: 08:00 - 16:30",
      "hireDate": "2026-09-29T20:49:40.000Z",
      "isActive": true
    }
  }
}
```

---

## 4. Gestión de Empresas (Multi-Tenant)

### `POST /companies`
Crea una nueva empresa u organización en la plataforma.
- **Autenticación**: Pública o SuperAdmin.
- **Body**:
```json
{
  "name": "Logística Norte S.A.",
  "cif": "A-88776655",
  "contactEmail": "contacto@logisticanorte.es",
  "contactPhone": "+34 944 000 111",
  "timezone": "Europe/Madrid"
}
```

### `GET /companies`
Devuelve los datos de la empresa correspondiente al administrador autenticado.
- **Autenticación**: Bearer JWT (Rol `ADMIN` o `MANAGER`).

---

## 5. Gestión de Trabajadores (Employees)

### `GET /employees`
Lista los trabajadores pertenecientes de forma exclusiva a la empresa del administrador.
- **Autenticación**: Bearer JWT (Rol `ADMIN` o `MANAGER`).
- **Bloqueo a Trabajadores**: Si un `EMPLOYEE` intenta consultar este endpoint, recibe `403 Forbidden`.

### `GET /employees/:id`
Consulta un trabajador por su ID.
- **Autenticación**: Bearer JWT.
- **Regla de Permisos**:
  - Si es `EMPLOYEE`: sólo puede consultar su propio ID (`req.user.employeeId === id`). Cualquier otro ID devuelve `403 Forbidden`.
  - Si es `ADMIN`: sólo puede consultar trabajadores de su misma empresa. Empleados de otra empresa devuelven `404 Not Found`.

### `POST /employees`
Crea un nuevo trabajador en la empresa del administrador.
- **Autenticación**: Bearer JWT (Rol `ADMIN`).
- **Body**:
```json
{
  "firstName": "Ana",
  "lastName": "Martínez Ruiz",
  "email": "ana.martinez@techlogistics.es",
  "password": "PasswordSegura123!",
  "phone": "+34 655 123 456",
  "documentId": "50123456Y",
  "employeeCode": "EMP-0050",
  "department": "Distribución",
  "jobTitle": "Repartidora",
  "schedule": "L-V 06:00 - 14:00"
}
```

### `PUT /employees/:id`
Edita la ficha del trabajador (datos de contacto, horario, puesto, departamento, estado activo).
- **Autenticación**: Bearer JWT (Rol `ADMIN`).

### `DELETE /employees/:id`
Desactiva a un trabajador y revoca inmediatamente todas sus sesiones activas.
- **Autenticación**: Bearer JWT (Rol `ADMIN`).

---

## 6. Fichajes de Trabajador

### `POST /attendance/punch`
Registra un fichaje puntual (Entrada o Salida) con adquisición única de GPS puntual.
- **Autenticación**: Bearer JWT (Rol `EMPLOYEE` o superior).
