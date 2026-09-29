# FITXAI - Especificación de Endpoints API v1

Base URL: `http://localhost:4000/api/v1`

---

## 1. Verificación de Salud

### `GET /health`
Verifica la disponibilidad del servidor y la conexión a la base de datos PostgreSQL.
- **Autenticación**: No requerida.
- **Respuesta 200 OK**:
```json
{
  "status": "ok",
  "timestamp": "2026-09-29T20:53:00.000Z",
  "services": {
    "database": {
      "status": "connected",
      "latencyMs": 3
    },
    "server": {
      "uptimeSeconds": 142,
      "environment": "development",
      "version": "1.0.0"
    }
  }
}
```

---

## 2. Autenticación

### `POST /auth/login`
Inicio de sesión con rate-limiting reforzado contra fuerza bruta.
- **Autenticación**: No requerida.
- **Body**:
```json
{
  "email": "carlos.garcia@techlogistics.es",
  "password": "Admin1234!",
  "platform": "android"
}
```
- **Respuesta 200 OK**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "u2222222-2222-2222-2222-222222222222",
    "email": "carlos.garcia@techlogistics.es",
    "role": "EMPLOYEE",
    "companyId": "c1111111-1111-1111-1111-111111111111",
    "employeeProfile": {
      "id": "e2222222-2222-2222-2222-222222222222",
      "firstName": "Carlos",
      "lastName": "García Moreno",
      "employeeCode": "EMP-0042"
    }
  }
}
```

---

## 3. Fichajes de Trabajador

### `POST /attendance/punch`
Registra un fichaje puntual (Entrada o Salida) con las coordenadas capturadas en ese instante exacto.
- **Autenticación**: Bearer JWT (Rol `EMPLOYEE` o superior).
- **Body**:
```json
{
  "type": "CHECK_IN",
  "latitude": 40.4530541,
  "longitude": -3.6883445,
  "accuracy": 8.5,
  "altitude": 667.2,
  "notes": "Inicio de turno"
}
```
- **Respuesta 201 Created**:
```json
{
  "success": true,
  "message": "Entrada registrada con éxito",
  "record": {
    "id": "att-uuid-...",
    "employeeId": "e2222222-2222-2222-2222-222222222222",
    "companyId": "c1111111-1111-1111-1111-111111111111",
    "type": "CHECK_IN",
    "timestamp": "2026-09-29T20:55:00.123Z",
    "status": "VERIFIED",
    "location": {
      "latitude": 40.4530541,
      "longitude": -3.6883445,
      "accuracy": 8.5,
      "capturedAt": "2026-09-29T20:55:00.123Z"
    }
  }
}
```

---

## 4. Panel de Administración

### `GET /admin/attendance`
Consulta los fichajes de la empresa con todos los datos y coordenadas asociadas.
- **Autenticación**: Bearer JWT (Rol `ADMIN` o `MANAGER`).
- **Query Params**: `limit` (default 50), `offset` (default 0).

### `GET /admin/stats`
Obtiene los contadores consolidados de la jornada actual (fichajes hoy, empleados activos, incidencias).
- **Autenticación**: Bearer JWT (Rol `ADMIN` o `MANAGER`).
