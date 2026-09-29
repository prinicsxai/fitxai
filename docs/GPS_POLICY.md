# Política Estricta de Geolocalización y Privacidad (FITXAI)

## 1. Principio Fundamental: NO al GPS Continuo

En FITXAI el respeto a la intimidad del trabajador y el estricto cumplimiento normativo (RGPD de la Unión Europea y Ley Orgánica 3/2018 de Protección de Datos en España) constituyen un pilar fundacional del diseño técnico del software.

### Reglas Técnicas Obligatorias:

1. **Uso Exclusivo en el Instante del Clic**:
   - El sensor de geolocalización (GPS) se activa **únicamente** cuando el trabajador pulsa deliberadamente el botón:
     - `"FICHAR ENTRADA"`
     - `"FICHAR SALIDA"`
2. **Apagado Inmediato**:
   - Una vez leídas las coordenadas (`latitude`, `longitude`) y la precisión (`accuracy`) con una sola muestra, el sensor se **desactiva inmediatamente**.
3. **Prohibiciones Absolutas**:
   - ❌ **NO mantener GPS activo**.
   - ❌ **NO registrar rutas ni trayectorias**.
   - ❌ **NO realizar seguimiento ni tracking**.
   - ❌ **NO obtener ubicación en segundo plano (`background location`)**.
   - ❌ **NO obtener ubicación durante el resto de la jornada**.
   - ❌ **NO almacenar posiciones periódicas**.

---

## 2. Modelo de Persistencia en Base de Datos

Cada registro de ubicación (`location_records`) está vinculado de forma estricta **1 a 1** con un fichaje puntual (`attendance_records`):

```sql
CREATE TABLE location_records (
    id VARCHAR(36) PRIMARY KEY,
    attendance_record_id VARCHAR(36) NOT NULL UNIQUE REFERENCES attendance_records(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION NOT NULL, -- en metros
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

- **Restricción UNIQUE**: Garantiza a nivel de base de datos que no puede haber múltiples localizaciones asociadas a un mismo evento ni lecturas huérfanas en el tiempo.
- **La ubicación representa únicamente el punto geográfico donde se ha producido el fichaje de inicio o fin de jornada.**
