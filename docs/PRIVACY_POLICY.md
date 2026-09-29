# POLÍTICA DE PRIVACIDAD Y PROTECCIÓN DE DATOS - FITXAI

**Fecha de última actualización:** Octubre 2026  
**Ámbito de aplicación:** Sistema de Control Horario y Fichaje Empresarial FITXAI (Panel Web y Aplicación Móvil)

---

## 1. PRINCIPIO FUNDAMENTAL: PRIVACIDAD POR DISEÑO Y POR DEFECTO

FITXAI ha sido diseñado e implementado bajo los principios de **Protección de Datos desde el Diseño y por Defecto** (*Privacy by Design & by Default*), en estricto cumplimiento del **Reglamento General de Protección de Datos (RGPD UE 2016/679)** y de la **Ley Orgánica 3/2018 (LOPDGDD)** de España.

### Regla de Oro del Sistema FITXAI
> **NO EXISTE SEGUIMIENTO GPS CONTINUO. NO EXISTE RASTREO EN SEGUNDO PLANO.**

1. **Activación Exclusiva por Demanda:** Los sensores de ubicación (GPS / Geolocation API) del dispositivo se activan **única y exclusivamente en el instante milimétrico** en que la persona trabajadora pulsa deliberadamente el botón:
   - `"FICHAR ENTRADA"`
   - `"FICHAR SALIDA"`
2. **Apagado Inmediato de Sensores:** Una vez capturada la coordenada puntual de latitud, longitud y precisión requerida para validar el evento, **el sensor GPS se desactiva inmediatamente**, destruyendo cualquier escucha (*watcher*) o proceso de geolocalización.
3. **Prohibición Total de Rutas e Itinerarios:** El sistema **no registra, no recopila, no procesa y no almacena rutas, desplazamientos, trayectorias, historiales de movimiento ni geolocalización entre turnos**.
4. **Vinculación 1:1 Estricta:** Cada dato de coordenadas GPS capturado pertenece estrictamente a un único registro de fichaje puntual (`attendance_record_id`) a través de la tabla relacional `location_records`. No existen registros de ubicación huérfanos ni periódicos.

---

## 2. BASE JURÍDICA DEL TRATAMIENTO

El tratamiento de datos personales efectuado por FITXAI se fundamenta en:

1. **Cumplimiento de una obligación legal (Art. 6.1.c del RGPD):**
   - **Artículo 34.9 del Estatuto de los Trabajadores (Real Decreto-ley 8/2019, de 8 de marzo):** Obligación empresarial ineludible de garantizar el registro diario de jornada, que deberá incluir el horario concreto de inicio y finalización de cada persona trabajadora.
2. **Facultades de control laboral y uso de dispositivos de geolocalización (Art. 20.bis y 20.3 del Estatuto de los Trabajadores y Art. 90 de la LOPDGDD):**
   - El empleador puede tratar imágenes o datos de geolocalización para el ejercicio de las funciones de control previstas en la ley, **siempre informando de forma expresa, clara e inequívoca** a los trabajadores sobre la existencia y características de estos dispositivos.
   - FITXAI cumple estrictamente con el principio de **proporcionalidad y mínima invasividad** al verificar únicamente el lugar exacto de inicio y fin de jornada (para validar centro de trabajo o teletrabajo), absteniéndose de monitorizar el tiempo de trabajo efectivo ni los descansos.

---

## 3. FINALIDAD DEL TRATAMIENTO Y DATOS RECOPILADOS

FITXAI trata exclusivamente las siguientes categorías de datos:

| Categoría | Datos Específicos | Finalidad | Base Legal |
| :--- | :--- | :--- | :--- |
| **Identificativos** | Nombre, Apellidos, DNI/NIE, Email, Teléfono, Código Empleado | Gestión de cuentas de usuario y atribución personal de la jornada | Art. 6.1.c RGPD / Art. 34.9 ET |
| **Laborales** | Departamento, Puesto de Trabajo, Horario de Trabajo Asignado | Verificación de jornada y cómputo de horas ordinarias/extraordinarias | Art. 34.9 ET |
| **Fichaje de Jornada** | Fecha, Hora exacta oficial del servidor, Tipo (Entrada/Salida), Estado | Control y registro fehaciente de jornada laboral | Obligación Legal (ET) |
| **Geolocalización Puntual** | Latitud, Longitud, Precisión estimada en metros (±Xm) | Constancia del lugar de inicio o fin de la prestación laboral | Art. 90 LOPDGDD / Proporcionalidad |
| **Auditoría Técnica** | Dirección IP de conexión, User-Agent del navegador o app | Seguridad de la plataforma, prevención de accesos indebidos e integridad | Art. 32 RGPD (Seguridad) |

---

## 4. INFORMACIÓN AL TRABAJADOR Y DERECHO DE INFORMACIÓN

Toda persona trabajadora dada de alta en FITXAI tiene acceso directo y transparente a:

1. **Mensaje informativo antes del primer fichaje:** La aplicación móvil solicita el permiso de ubicación explicando expresamente:
   > *"FITXAI requiere acceso a tu ubicación solo en el momento de pulsar Fichar para certificar el inicio o fin de tu jornada según la normativa laboral. La app nunca rastreará tu ubicación en segundo plano ni registrará tus desplazamientos."*
2. **Historial personal sin intermediarios ("Mis Fichajes"):** El trabajador puede consultar en cualquier momento todas sus entradas y salidas, horas calculadas y el punto geográfico puntual registrado.
3. **Canal de incidencias:** Posibilidad de notificar incidencias (olvidos de fichaje, errores de conexión o incidencias de cobertura GPS) para su resolución auditada.

---

## 5. PLAZO DE CONSERVACIÓN DE LOS DATOS

Conforme al **artículo 34.9 del Estatuto de los Trabajadores**, la empresa está legalmente obligada a conservar los registros de jornada durante un periodo mínimo de **cuatro (4) años**.
- Durante este plazo, los registros permanecerán en custodia inmutable a disposición de las personas trabajadoras, de sus representantes legales y de la Inspección de Trabajo y Seguridad Social (ITSS).
- Transcurrido el plazo legal y prescriptas las responsabilidades laborales o administrativas, los datos serán eliminados o anonimizados de forma irreversible.

---

## 6. DESTINATARIOS Y TRANSFERENCIAS INTERNACIONALES

- **Aislamiento Multi-Tenant Estricto:** Cada empresa cuenta con un espacio de datos estrictamente segregado. Ningún administrador o usuario de una Empresa A puede visualizar directa o indirectamente datos de la Empresa B.
- **Acceso Restringido a Trabajadores:** Los trabajadores únicamente tienen acceso a sus propios datos y fichajes personales.
- **Cesión Legal:** Los datos solo se comunicarán a la Inspección de Trabajo y Seguridad Social, a los tribunales de justicia o a la representación legal de los trabajadores cuando exista requerimiento legal fundado.
- **Transferencias Internacionales:** El servidor backend, la base de datos PostgreSQL y los almacenes de sesión residen en la Unión Europea o en entornos con nivel de protección equivalente reconocido por la Comisión Europea.

---

## 7. EJERCICIO DE DERECHOS RGPD (ARCO-POL)

Las personas trabajadoras pueden ejercer en cualquier momento sus derechos de:
- **Acceso:** Consultar qué datos suyos obran en el sistema y obtener copia de sus registros de jornada.
- **Rectificación:** Solicitar corrección de fichajes erróneos u olvidados a través del módulo de incidencias reglamentario.
- **Supresión ("Derecho al olvido"):** Aplicable únicamente cuando los datos no sean legalmente requeridos para el cumplimiento de las obligaciones de conservación laboral de 4 años.
- **Limitación y Oposición:** En los supuestos contemplados en los artículos 18 y 21 del RGPD.

Para ejercer sus derechos, el trabajador puede dirigirse al Responsable de Protección de Datos de su empresa o al buzón de contacto oficial configurado en FITXAI.
