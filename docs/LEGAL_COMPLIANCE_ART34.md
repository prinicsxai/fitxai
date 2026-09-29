# GUÍA DE CUMPLIMIENTO LEGAL - ART. 34.9 ESTATUTO DE LOS TRABAJADORES

**Normativa de Referencia:**
- Real Decreto-ley 8/2019, de 8 de marzo, de medidas urgentes de protección social y de lucha contra la precariedad laboral en la jornada de trabajo.
- Artículo 34, apartado 9, del Real Decreto Legislativo 2/2015, de 23 de octubre (Texto Refundido de la Ley del Estatuto de los Trabajadores - ET).
- Criterio Técnico 101/2019 de la Dirección General de la Inspección de Trabajo y Seguridad Social (ITSS) sobre el registro de jornada.
- Guía práctica del Ministerio de Trabajo, Migraciones y Seguridad Social sobre el registro de jornada.

---

## 1. REQUISITOS LEGALES EXIGIDOS Y SOLUCIÓN FITXAI

| Requisito Legal (Art. 34.9 ET / Criterio 101/2019) | Implementación y Garantía en FITXAI |
| :--- | :--- |
| **1. Obligatoriedad del Registro Diario**<br>Debe registrarse el horario concreto de inicio y finalización de cada jornada de cada persona trabajadora. | FITXAI implementa botones diferenciados de `FICHAR ENTRADA` y `FICHAR SALIDA`, registrando de forma fehaciente el inicio y fin de cada tramo o jornada laboral. |
| **2. Objetividad y Fiabilidad**<br>El sistema debe ser objetivo, fiable y garantizar la constancia de los datos. | La hora y fecha registradas provienen **exclusivamente del reloj del servidor (NTP sincronizado)**, impidiendo manipulaciones en los relojes locales de los dispositivos. |
| **3. Inalterabilidad y No Manipulación**<br>Los registros no pueden ser alterados a posteriori sin dejar constancia. | Toda regularización o corrección por parte de la empresa requiere motivo justificado y queda registrada de forma permanente e inmutable en `audit_logs` con los valores previos y posteriores. |
| **4. Conservación durante Cuatro (4) Años**<br>La empresa debe conservar los registros durante 4 años a disposición de los trabajadores, sus representantes y la Inspección. | La base de datos de FITXAI está dimensionada y asegurada con índices temporales y copias de seguridad para garantizar la custodia íntegra durante al menos 4 años naturales. |
| **5. Disponibilidad Inmediata en el Centro de Trabajo**<br>Los registros deben ser accesibles en cualquier momento ante una visita de la Inspección de Trabajo. | El panel web de administración permite consultar en tiempo real y exportar instantáneamente los informes oficiales en formatos abiertos estándar (PDF, Excel y CSV). |
| **6. Acceso para los Trabajadores**<br>Cada persona trabajadora debe poder conocer y acceder a sus propios registros. | A través de la aplicación móvil (apartado "Mis Fichajes"), cada empleado tiene acceso permanente y directo a todos sus registros históricos sin depender de solicitudes a Recursos Humanos. |
| **7. Respeto a la Privacidad (Art. 20.bis ET y Art. 90 LOPDGDD)**<br>Prohibición de intromisiones desproporcionadas en la intimidad y vida privada. | **Punto GPS Único:** Solo se capta la posición en el instante de la pulsación de Fichar. Se prohíbe el rastreo continuo, el seguimiento en segundo plano y el almacenamiento de trayectorias. |

---

## 2. FORMATOS DE EXPORTACIÓN Y VALIDEZ PROBATORIA ANTE LA ITSS

Ante un requerimiento o visita de la Inspección de Trabajo y Seguridad Social, FITXAI ofrece 3 vías inmediatas de acreditación documental:

1. **Documento Oficial PDF / Imprimible:**
   - Incluye membrete oficial de la empresa, CIF, domicilio social y centro de trabajo.
   - Detalle por trabajador: DNI/NIE, horas de entrada y salida día a día, duración calculada y cómputo acumulado de horas ordinarias.
   - Casilla reglamentaria para firma y sello de la dirección de la empresa y de la representación legal de los trabajadores.
   - Cláusula de acreditación de cumplimiento del Real Decreto-ley 8/2019.
2. **Exportación Estructurada CSV:**
   - Codificación UTF-8 con BOM (`\uFEFF`) y separador por punto y coma `;` para compatibilidad directa e inmediata con Microsoft Excel y hojas de cálculo de la Administración Pública.
3. **Hoja de Cálculo Excel Nativa (.xls):**
   - Formato XML Spreadsheet estructurado con columnas de duración en formato numérico decimal para comprobación de fórmulas y sumas de horas.

---

## 3. PROCEDIMIENTO ANTE UNA INSPECCIÓN DE TRABAJO

Si un inspector de la ITSS se persona en el centro de trabajo o solicita telemáticamente los registros:
1. El Administrador accede a su Panel Web FITXAI -> Menú **Informes**.
2. Selecciona el periodo requerido (ej. mes actual o meses precedentes).
3. Puede filtrar por trabajador o generar el informe de la plantilla completa.
4. Pulsa **PDF Oficial** para imprimir o descargar en el acto, o **Excel / CSV** para remitir por la sede electrónica del Ministerio.
5. El sistema entrega la información de inmediato, cumpliendo con la exigencia de disponibilidad instantánea sin demoras injustificadas.
