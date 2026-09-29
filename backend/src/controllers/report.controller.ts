import { Request, Response } from 'express';
import { query } from '../db/pool';

interface PunchRecord {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  document_id: string;
  employee_code: string | null;
  department: string | null;
  type: 'CHECK_IN' | 'CHECK_OUT';
  timestamp: Date;
  status: string;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

interface IncidentRecord {
  id: string;
  employee_id: string;
  type: string;
  status: string;
  severity: string;
  description: string;
  admin_comment: string | null;
  requested_time: Date | null;
  requested_punch_type: string | null;
  created_at: Date;
}

interface Anomaly {
  type: 'UNCLOSED_CHECK_IN' | 'ORPHAN_CHECK_OUT' | 'DUPLICATE_PUNCH' | 'OVERLONG_SHIFT';
  description: string;
  timestamp: string;
  details?: any;
}

interface Shift {
  id: string;
  date: string; // YYYY-MM-DD
  checkInTime: string | null;
  checkOutTime: string | null;
  durationMinutes: number;
  durationFormatted: string;
  durationDecimal: number;
  checkInLocation: { lat: number; lng: number; accuracy: number } | null;
  checkOutLocation: { lat: number; lng: number; accuracy: number } | null;
  status: 'COMPLETED' | 'INCOMPLETE' | 'ANOMALOUS';
  anomalies: Anomaly[];
}

interface EmployeeReport {
  employeeId: string;
  fullName: string;
  documentId: string;
  employeeCode: string;
  department: string;
  totalDurationMinutes: number;
  totalHoursDecimal: number;
  totalHoursFormatted: string;
  totalEntries: number;
  totalExits: number;
  totalIncidents: number;
  incompletePunchesCount: number;
  anomalies: Anomaly[];
  shifts: Shift[];
  dailyHours: Record<string, { minutes: number; decimal: number; formatted: string; shiftsCount: number }>;
  weeklyHours: Record<string, { minutes: number; decimal: number; formatted: string }>;
  monthlyHours: Record<string, { minutes: number; decimal: number; formatted: string }>;
}

/**
 * Helper: Obtener número de semana ISO (YYYY-Www)
 */
function getIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Helper: Formatear minutos en texto "Xh Ym"
 */
function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Helper: Formatear fecha local en YYYY-MM-DD
 */
function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Motor central de cálculo de horas y detección de anomalías
 */
async function computeCompanyReport(companyId: string, options: {
  employeeId?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  week?: string;
  month?: string;
}) {
  // 1. Resolver fechas
  let start: Date;
  let end: Date;

  if (options.month) {
    // Formato YYYY-MM
    const [yearStr, monthStr] = options.month.split('-');
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10) - 1;
    start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
    end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  } else if (options.week) {
    // Formato YYYY-Www
    const [yearStr, weekPart] = options.week.split('-W');
    const y = parseInt(yearStr, 10);
    const w = parseInt(weekPart, 10);
    const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
    const dow = simple.getUTCDay();
    const isoWeekStart = simple;
    if (dow <= 4) {
      isoWeekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
    } else {
      isoWeekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
    }
    start = new Date(isoWeekStart.setUTCHours(0, 0, 0, 0));
    end = new Date(start.getTime() + 7 * 86400000 - 1);
  } else {
    if (options.startDate) {
      start = new Date(options.startDate);
      start.setHours(0, 0, 0, 0);
    } else {
      // 30 días atrás por defecto
      start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    }

    if (options.endDate) {
      end = new Date(options.endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }
  }

  // 2. Obtener datos de la empresa
  const compRows = await query<any>(
    `SELECT id, name, cif, address, contact_email, contact_phone, timezone FROM companies WHERE id = $1`,
    [companyId]
  );
  const company = compRows[0] || { name: 'Empresa', cif: 'N/A' };

  // 3. Obtener empleados objetivo
  const empConditions = ['e.company_id = $1'];
  const empParams: any[] = [companyId];
  let pIdx = 2;

  if (options.employeeId) {
    empConditions.push(`e.id = $${pIdx}`);
    empParams.push(options.employeeId);
    pIdx++;
  }

  if (options.department && options.department !== 'ALL') {
    empConditions.push(`e.department = $${pIdx}`);
    empParams.push(options.department);
    pIdx++;
  }

  const employees = await query<any>(
    `SELECT id, first_name, last_name, document_id, employee_code, department, job_title
     FROM employees e
     WHERE ${empConditions.join(' AND ')}
     ORDER BY e.last_name ASC, e.first_name ASC`,
    empParams
  );

  // 4. Obtener todos los fichajes en el rango
  const punchRows = await query<PunchRecord>(
    `SELECT 
      ar.id,
      ar.employee_id,
      e.first_name,
      e.last_name,
      e.document_id,
      e.employee_code,
      e.department,
      ar.type,
      ar.timestamp,
      ar.status,
      ar.notes,
      lr.latitude,
      lr.longitude,
      lr.accuracy
     FROM attendance_records ar
     JOIN employees e ON e.id = ar.employee_id
     LEFT JOIN location_records lr ON lr.attendance_record_id = ar.id
     WHERE ar.company_id = $1 
       AND ar.timestamp >= $2 
       AND ar.timestamp <= $3
     ORDER BY ar.employee_id ASC, ar.timestamp ASC`,
    [companyId, start, end]
  );

  // 5. Obtener incidencias en el rango
  const incidentRows = await query<IncidentRecord>(
    `SELECT id, employee_id, type, status, severity, description, admin_comment, requested_time, requested_punch_type, created_at
     FROM incidents
     WHERE company_id = $1 AND created_at >= $2 AND created_at <= $3`,
    [companyId, start, end]
  );

  // 6. Procesar por cada empleado
  const employeeReports: EmployeeReport[] = [];
  let companyTotalMinutes = 0;
  let companyTotalPunches = punchRows.length;
  let companyTotalAnomalies = 0;
  let companyTotalIncidents = incidentRows.length;

  for (const emp of employees) {
    const empPunches = punchRows.filter(p => p.employee_id === emp.id);
    const empIncidents = incidentRows.filter(i => i.employee_id === emp.id);

    const shifts: Shift[] = [];
    const empAnomalies: Anomaly[] = [];
    let currentCheckIn: PunchRecord | null = null;
    let totalEntries = 0;
    let totalExits = 0;
    let incompleteCount = 0;

    for (let i = 0; i < empPunches.length; i++) {
      const punch = empPunches[i];
      const prevPunch = i > 0 ? empPunches[i - 1] : null;

      // Detección: Fichajes duplicados (mismo tipo con menos de 5 minutos de diferencia)
      if (prevPunch && prevPunch.type === punch.type) {
        const diffMs = Math.abs(new Date(punch.timestamp).getTime() - new Date(prevPunch.timestamp).getTime());
        if (diffMs < 5 * 60 * 1000) {
          const anom: Anomaly = {
            type: 'DUPLICATE_PUNCH',
            description: `Fichaje duplicado de ${punch.type === 'CHECK_IN' ? 'Entrada' : 'Salida'} en intervalo de ${Math.round(diffMs / 1000)}s`,
            timestamp: new Date(punch.timestamp).toISOString(),
            details: { recordId: punch.id, prevRecordId: prevPunch.id },
          };
          empAnomalies.push(anom);
          companyTotalAnomalies++;
        }
      }

      if (punch.type === 'CHECK_IN') {
        totalEntries++;

        // Si ya había una entrada previa sin salida -> Anomalía Entrada sin salida
        if (currentCheckIn) {
          incompleteCount++;
          const anom: Anomaly = {
            type: 'UNCLOSED_CHECK_IN',
            description: `Entrada sin salida registrada: se produjo una nueva entrada sin haber cerrado la anterior`,
            timestamp: new Date(currentCheckIn.timestamp).toISOString(),
            details: { previousCheckInId: currentCheckIn.id },
          };
          empAnomalies.push(anom);
          companyTotalAnomalies++;

          // Registrar turno incompleto
          shifts.push({
            id: currentCheckIn.id,
            date: formatDateKey(new Date(currentCheckIn.timestamp)),
            checkInTime: new Date(currentCheckIn.timestamp).toISOString(),
            checkOutTime: null,
            durationMinutes: 0,
            durationFormatted: 'Incompleto (Sin salida)',
            durationDecimal: 0,
            checkInLocation: currentCheckIn.latitude !== null ? {
              lat: currentCheckIn.latitude,
              lng: currentCheckIn.longitude!,
              accuracy: currentCheckIn.accuracy!,
            } : null,
            checkOutLocation: null,
            status: 'INCOMPLETE',
            anomalies: [anom],
          });
        }

        currentCheckIn = punch;
      } else if (punch.type === 'CHECK_OUT') {
        totalExits++;

        if (!currentCheckIn) {
          // Salida sin entrada previa -> Anomalía
          incompleteCount++;
          const anom: Anomaly = {
            type: 'ORPHAN_CHECK_OUT',
            description: `Salida sin entrada previa registrada en el sistema`,
            timestamp: new Date(punch.timestamp).toISOString(),
            details: { checkOutId: punch.id },
          };
          empAnomalies.push(anom);
          companyTotalAnomalies++;

          shifts.push({
            id: punch.id,
            date: formatDateKey(new Date(punch.timestamp)),
            checkInTime: null,
            checkOutTime: new Date(punch.timestamp).toISOString(),
            durationMinutes: 0,
            durationFormatted: 'Incompleto (Sin entrada)',
            durationDecimal: 0,
            checkInLocation: null,
            checkOutLocation: punch.latitude !== null ? {
              lat: punch.latitude,
              lng: punch.longitude!,
              accuracy: punch.accuracy!,
            } : null,
            status: 'INCOMPLETE',
            anomalies: [anom],
          });
        } else {
          // Emparejamiento exitoso: Calcular duración
          const inMs = new Date(currentCheckIn.timestamp).getTime();
          const outMs = new Date(punch.timestamp).getTime();
          const durationMinutes = Math.max(0, Math.round((outMs - inMs) / 60000));
          const durationDecimal = Math.round((durationMinutes / 60) * 100) / 100;
          const shiftAnomalies: Anomaly[] = [];

          // Detección: Jornada anormalmente larga (> 10 horas)
          if (durationMinutes > 10 * 60) {
            const anom: Anomaly = {
              type: 'OVERLONG_SHIFT',
              description: `Jornada anormalmente larga detectada (${formatMinutes(durationMinutes)} > 10h)`,
              timestamp: new Date(currentCheckIn.timestamp).toISOString(),
              details: { durationMinutes },
            };
            shiftAnomalies.push(anom);
            empAnomalies.push(anom);
            companyTotalAnomalies++;
          }

          shifts.push({
            id: `${currentCheckIn.id}_${punch.id}`,
            date: formatDateKey(new Date(currentCheckIn.timestamp)),
            checkInTime: new Date(currentCheckIn.timestamp).toISOString(),
            checkOutTime: new Date(punch.timestamp).toISOString(),
            durationMinutes,
            durationFormatted: formatMinutes(durationMinutes),
            durationDecimal,
            checkInLocation: currentCheckIn.latitude !== null ? {
              lat: currentCheckIn.latitude,
              lng: currentCheckIn.longitude!,
              accuracy: currentCheckIn.accuracy!,
            } : null,
            checkOutLocation: punch.latitude !== null ? {
              lat: punch.latitude,
              lng: punch.longitude!,
              accuracy: punch.accuracy!,
            } : null,
            status: shiftAnomalies.length > 0 ? 'ANOMALOUS' : 'COMPLETED',
            anomalies: shiftAnomalies,
          });

          currentCheckIn = null; // Reiniciar turno abierto
        }
      }
    }

    // Si al terminar los fichajes queda una entrada abierta
    if (currentCheckIn) {
      const now = new Date();
      const inDate = new Date(currentCheckIn.timestamp);
      const isPastDay = formatDateKey(inDate) !== formatDateKey(now);
      const hoursSince = (now.getTime() - inDate.getTime()) / 3600000;

      // Si es de un día pasado o lleva más de 14 horas abierta -> Marcar como incompleta
      if (isPastDay || hoursSince > 14) {
        incompleteCount++;
        const anom: Anomaly = {
          type: 'UNCLOSED_CHECK_IN',
          description: `Entrada sin salida: la jornada no fue cerrada por el trabajador`,
          timestamp: inDate.toISOString(),
          details: { checkInId: currentCheckIn.id },
        };
        empAnomalies.push(anom);
        companyTotalAnomalies++;

        shifts.push({
          id: currentCheckIn.id,
          date: formatDateKey(inDate),
          checkInTime: inDate.toISOString(),
          checkOutTime: null,
          durationMinutes: 0,
          durationFormatted: 'Jornada no cerrada',
          durationDecimal: 0,
          checkInLocation: currentCheckIn.latitude !== null ? {
            lat: currentCheckIn.latitude,
            lng: currentCheckIn.longitude!,
            accuracy: currentCheckIn.accuracy!,
          } : null,
          checkOutLocation: null,
          status: 'INCOMPLETE',
          anomalies: [anom],
        });
      } else {
        // Jornada en curso hoy
        shifts.push({
          id: currentCheckIn.id,
          date: formatDateKey(inDate),
          checkInTime: inDate.toISOString(),
          checkOutTime: null,
          durationMinutes: 0,
          durationFormatted: 'En curso',
          durationDecimal: 0,
          checkInLocation: currentCheckIn.latitude !== null ? {
            lat: currentCheckIn.latitude,
            lng: currentCheckIn.longitude!,
            accuracy: currentCheckIn.accuracy!,
          } : null,
          checkOutLocation: null,
          status: 'COMPLETED',
          anomalies: [],
        });
      }
    }

    // Agregación de horas diarias, semanales y mensuales
    const dailyHours: Record<string, { minutes: number; decimal: number; formatted: string; shiftsCount: number }> = {};
    const weeklyHours: Record<string, { minutes: number; decimal: number; formatted: string }> = {};
    const monthlyHours: Record<string, { minutes: number; decimal: number; formatted: string }> = {};

    let totalDurationMinutes = 0;

    for (const shift of shifts) {
      if (shift.durationMinutes > 0 && shift.checkInTime) {
        totalDurationMinutes += shift.durationMinutes;
        const shiftDate = new Date(shift.checkInTime);
        const dayKey = formatDateKey(shiftDate);
        const weekKey = getIsoWeek(shiftDate);
        const monthKey = dayKey.slice(0, 7);

        // Diario
        if (!dailyHours[dayKey]) {
          dailyHours[dayKey] = { minutes: 0, decimal: 0, formatted: '', shiftsCount: 0 };
        }
        dailyHours[dayKey].minutes += shift.durationMinutes;
        dailyHours[dayKey].shiftsCount += 1;

        // Semanal
        if (!weeklyHours[weekKey]) {
          weeklyHours[weekKey] = { minutes: 0, decimal: 0, formatted: '' };
        }
        weeklyHours[weekKey].minutes += shift.durationMinutes;

        // Mensual
        if (!monthlyHours[monthKey]) {
          monthlyHours[monthKey] = { minutes: 0, decimal: 0, formatted: '' };
        }
        monthlyHours[monthKey].minutes += shift.durationMinutes;
      }
    }

    // Formatear totales
    Object.keys(dailyHours).forEach(k => {
      dailyHours[k].decimal = Math.round((dailyHours[k].minutes / 60) * 100) / 100;
      dailyHours[k].formatted = formatMinutes(dailyHours[k].minutes);
    });
    Object.keys(weeklyHours).forEach(k => {
      weeklyHours[k].decimal = Math.round((weeklyHours[k].minutes / 60) * 100) / 100;
      weeklyHours[k].formatted = formatMinutes(weeklyHours[k].minutes);
    });
    Object.keys(monthlyHours).forEach(k => {
      monthlyHours[k].decimal = Math.round((monthlyHours[k].minutes / 60) * 100) / 100;
      monthlyHours[k].formatted = formatMinutes(monthlyHours[k].minutes);
    });

    companyTotalMinutes += totalDurationMinutes;

    employeeReports.push({
      employeeId: emp.id,
      fullName: `${emp.first_name} ${emp.last_name}`,
      documentId: emp.document_id,
      employeeCode: emp.employee_code || 'N/A',
      department: emp.department || 'General',
      totalDurationMinutes,
      totalHoursDecimal: Math.round((totalDurationMinutes / 60) * 100) / 100,
      totalHoursFormatted: formatMinutes(totalDurationMinutes),
      totalEntries,
      totalExits,
      totalIncidents: empIncidents.length,
      incompletePunchesCount: incompleteCount,
      anomalies: empAnomalies,
      shifts,
      dailyHours,
      weeklyHours,
      monthlyHours,
    });
  }

  const totalHoursDecimal = Math.round((companyTotalMinutes / 60) * 100) / 100;

  return {
    company,
    period: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      startDateFormatted: start.toISOString().slice(0, 10),
      endDateFormatted: end.toISOString().slice(0, 10),
    },
    summary: {
      totalEmployees: employees.length,
      totalHoursWorked: formatMinutes(companyTotalMinutes),
      totalHoursDecimal,
      totalPunches: companyTotalPunches,
      totalAnomalies: companyTotalAnomalies,
      totalIncidents: companyTotalIncidents,
    },
    employees: employeeReports,
  };
}

/**
 * GET /reports
 * Obtener informe detallado consolidado con cálculo de horas y anomalías
 */
export async function getDetailedReport(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { employeeId, department, startDate, endDate, week, month } = req.query as Record<string, string>;

    const report = await computeCompanyReport(user.companyId, {
      employeeId,
      department,
      startDate,
      endDate,
      week,
      month,
    });

    return res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error('Error generating detailed report:', error);
    return res.status(500).json({ success: false, error: 'Error al generar el informe' });
  }
}

/**
 * GET /reports/export/csv
 * Exportación directa a CSV con cabeceras RFC 4180 y UTF-8 BOM
 */
export async function exportReportCsv(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { employeeId, department, startDate, endDate, week, month } = req.query as Record<string, string>;

    const report = await computeCompanyReport(user.companyId, {
      employeeId,
      department,
      startDate,
      endDate,
      week,
      month,
    });

    // Construir contenido CSV
    const rows: string[] = [];

    // Metadatos iniciales
    rows.push(`"INFORME OFICIAL DE REGISTRO DE JORNADA LABORAL"`);
    rows.push(`"Empresa";"${report.company.name}";"CIF";"${report.company.cif}"`);
    rows.push(`"Periodo";"${report.period.startDateFormatted} al ${report.period.endDateFormatted}"`);
    rows.push(`"Generado";"${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}"`);
    rows.push(`"Total Horas";"${report.summary.totalHoursWorked}";"Total Trabajadores";"${report.summary.totalEmployees}";"Total Incidencias";"${report.summary.totalIncidents}"`);
    rows.push('');

    // Cabecera de columnas
    rows.push('"Trabajador";"DNI/NIE";"Código";"Departamento";"Fecha";"Hora Entrada";"Hora Salida";"Duración (Horas)";"Horas Decimal";"Estado";"Anomalías / Incidencias"');

    for (const emp of report.employees) {
      if (emp.shifts.length === 0) {
        rows.push(`"${emp.fullName}";"${emp.documentId}";"${emp.employeeCode}";"${emp.department}";"Sin registros";"";"";"0h 00m";"0.00";"SIN ACTIVIDAD";""`);
      } else {
        for (const shift of emp.shifts) {
          const entryTime = shift.checkInTime ? new Date(shift.checkInTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';
          const exitTime = shift.checkOutTime ? new Date(shift.checkOutTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';
          const anomaliesText = shift.anomalies.map(a => a.description).join(' | ');

          rows.push(
            `"${emp.fullName}";"${emp.documentId}";"${emp.employeeCode}";"${emp.department}";"${shift.date}";"${entryTime}";"${exitTime}";"${shift.durationFormatted}";"${shift.durationDecimal.toFixed(2)}";"${shift.status}";"${anomaliesText}"`
          );
        }
      }
    }

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const filename = `informe_fichajes_${report.company.cif}_${report.period.startDateFormatted}_${report.period.endDateFormatted}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error: any) {
    console.error('Error exporting CSV:', error);
    return res.status(500).json({ success: false, error: 'Error al exportar CSV' });
  }
}

/**
 * GET /reports/export/excel
 * Exportación directa a formato Excel Spreadsheet XML compatible con Excel y Calc
 */
export async function exportReportExcel(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { employeeId, department, startDate, endDate, week, month } = req.query as Record<string, string>;

    const report = await computeCompanyReport(user.companyId, {
      employeeId,
      department,
      startDate,
      endDate,
      week,
      month,
    });

    const escapeXml = (str: string) => String(str || '').replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });

    let xmlRows = '';

    // Filas de datos
    for (const emp of report.employees) {
      if (emp.shifts.length === 0) {
        xmlRows += `
        <Row>
          <Cell><Data ss:Type="String">${escapeXml(emp.fullName)}</Data></Cell>
          <Cell><Data ss:Type="String">${escapeXml(emp.documentId)}</Data></Cell>
          <Cell><Data ss:Type="String">${escapeXml(emp.employeeCode)}</Data></Cell>
          <Cell><Data ss:Type="String">${escapeXml(emp.department)}</Data></Cell>
          <Cell><Data ss:Type="String">Sin actividad</Data></Cell>
          <Cell><Data ss:Type="String">-</Data></Cell>
          <Cell><Data ss:Type="String">-</Data></Cell>
          <Cell><Data ss:Type="String">0h 00m</Data></Cell>
          <Cell><Data ss:Type="Number">0</Data></Cell>
          <Cell><Data ss:Type="String">SIN REGISTROS</Data></Cell>
          <Cell><Data ss:Type="String">-</Data></Cell>
        </Row>`;
      } else {
        for (const shift of emp.shifts) {
          const entryTime = shift.checkInTime ? new Date(shift.checkInTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-';
          const exitTime = shift.checkOutTime ? new Date(shift.checkOutTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-';
          const anomaliesText = shift.anomalies.map(a => a.description).join('; ');

          xmlRows += `
          <Row>
            <Cell><Data ss:Type="String">${escapeXml(emp.fullName)}</Data></Cell>
            <Cell><Data ss:Type="String">${escapeXml(emp.documentId)}</Data></Cell>
            <Cell><Data ss:Type="String">${escapeXml(emp.employeeCode)}</Data></Cell>
            <Cell><Data ss:Type="String">${escapeXml(emp.department)}</Data></Cell>
            <Cell><Data ss:Type="String">${escapeXml(shift.date)}</Data></Cell>
            <Cell><Data ss:Type="String">${escapeXml(entryTime)}</Data></Cell>
            <Cell><Data ss:Type="String">${escapeXml(exitTime)}</Data></Cell>
            <Cell><Data ss:Type="String">${escapeXml(shift.durationFormatted)}</Data></Cell>
            <Cell><Data ss:Type="Number">${shift.durationDecimal}</Data></Cell>
            <Cell><Data ss:Type="String">${escapeXml(shift.status)}</Data></Cell>
            <Cell><Data ss:Type="String">${escapeXml(anomaliesText)}</Data></Cell>
          </Row>`;
        }
      }
    }

    const xmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="TitleStyle">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="14" ss:Color="#0F172A" ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Fichajes">
  <Table ss:ExpandedColumnCount="11" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="18">
   <Column ss:AutoFitWidth="0" ss:Width="160"/>
   <Column ss:AutoFitWidth="0" ss:Width="100"/>
   <Column ss:AutoFitWidth="0" ss:Width="80"/>
   <Column ss:AutoFitWidth="0" ss:Width="120"/>
   <Column ss:AutoFitWidth="0" ss:Width="90"/>
   <Column ss:AutoFitWidth="0" ss:Width="80"/>
   <Column ss:AutoFitWidth="0" ss:Width="80"/>
   <Column ss:AutoFitWidth="0" ss:Width="100"/>
   <Column ss:AutoFitWidth="0" ss:Width="80"/>
   <Column ss:AutoFitWidth="0" ss:Width="100"/>
   <Column ss:AutoFitWidth="0" ss:Width="250"/>

   <Row ss:Height="24">
    <Cell ss:StyleID="TitleStyle"><Data ss:Type="String">FITXAI - REGISTRO DE JORNADA LABORAL (${escapeXml(report.company.name)} - CIF: ${escapeXml(report.company.cif)})</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Periodo: ${escapeXml(report.period.startDateFormatted)} al ${escapeXml(report.period.endDateFormatted)}</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Horas Totales: ${escapeXml(report.summary.totalHoursWorked)} | Incidencias: ${report.summary.totalIncidents} | Fichajes: ${report.summary.totalPunches}</Data></Cell>
   </Row>
   <Row/>

   <Row ss:Height="22">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Trabajador</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">DNI/NIE</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Código</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Departamento</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Entrada</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Salida</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Duración</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Horas Dec.</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Estado</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Anomalías / Incidencias</Data></Cell>
   </Row>
   ${xmlRows}
  </Table>
 </Worksheet>
</Workbook>`;

    const filename = `informe_fichajes_${report.company.cif}_${report.period.startDateFormatted}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(xmlTemplate);
  } catch (error: any) {
    console.error('Error exporting Excel:', error);
    return res.status(500).json({ success: false, error: 'Error al exportar Excel' });
  }
}

/**
 * GET /reports/export/pdf
 * Generación de documento oficial para impresión PDF (Cumplimiento Art. 34.9 ET)
 */
export async function exportReportPdf(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { employeeId, department, startDate, endDate, week, month } = req.query as Record<string, string>;

    const report = await computeCompanyReport(user.companyId, {
      employeeId,
      department,
      startDate,
      endDate,
      week,
      month,
    });

    const rowsHtml = report.employees.flatMap(emp => 
      emp.shifts.map(shift => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${emp.fullName}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${emp.documentId}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${emp.department}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${shift.date}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; color: #166534;">${shift.checkInTime ? new Date(shift.checkInTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; color: #991b1b;">${shift.checkOutTime ? new Date(shift.checkOutTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${shift.durationFormatted}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">
            <span style="display: inline-block; padding: 2px 6px; font-size: 11px; border-radius: 4px; font-weight: 600; ${
              shift.status === 'COMPLETED' ? 'background: #dcfce7; color: #166534;' :
              shift.status === 'ANOMALOUS' ? 'background: #fef3c7; color: #92400e;' :
              'background: #fee2e2; color: #991b1b;'
            }">
              ${shift.status === 'COMPLETED' ? 'Correcto' : shift.status === 'ANOMALOUS' ? 'Anomalía' : 'Incompleto'}
            </span>
          </td>
        </tr>
      `)
    ).join('');

    const htmlDoc = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Registro Oficial de Jornada Laboral - ${report.company.name}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 13px; line-height: 1.5; }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0; }
    .subtitle { font-size: 12px; color: #64748b; margin: 0; }
    .badge { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .summary-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
    .summary-value { font-size: 20px; font-weight: 700; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; text-align: left; }
    th { background: #f1f5f9; padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; page-break-inside: avoid; }
    .sig-box { border: 1px dashed #94a3b8; border-radius: 8px; padding: 20px; height: 90px; text-align: center; }
    .sig-label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 60px; }
    .legal-notice { font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 30px; text-align: justify; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; text-align: right;">
    <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer;">
      🖨️ Imprimir / Guardar como PDF
    </button>
  </div>

  <div class="header">
    <div>
      <h1 class="title">Registro Oficial de Jornada de Trabajo</h1>
      <p class="subtitle">Documento acreditativo conforme al Real Decreto-ley 8/2019 y Art. 34.9 del Estatuto de los Trabajadores</p>
    </div>
    <div style="text-align: right;">
      <span class="badge">FITXAI VERIFICADO</span>
      <p style="margin: 6px 0 0 0; font-size: 12px; font-weight: 600;">${report.company.name}</p>
      <p style="margin: 0; font-size: 11px; color: #64748b;">CIF: ${report.company.cif}</p>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Periodo Liquidación</div>
      <div class="summary-value" style="font-size: 14px;">${report.period.startDateFormatted} al ${report.period.endDateFormatted}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Horas Totales Computadas</div>
      <div class="summary-value" style="color: #0284c7;">${report.summary.totalHoursWorked}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Trabajadores Activos</div>
      <div class="summary-value">${report.summary.totalEmployees}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Incidencias / Anomalías</div>
      <div class="summary-value" style="color: ${report.summary.totalAnomalies > 0 ? '#d97706' : '#16a34a'};">${report.summary.totalAnomalies}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Trabajador</th>
        <th>DNI / NIE</th>
        <th>Departamento</th>
        <th>Fecha</th>
        <th>Entrada</th>
        <th>Salida</th>
        <th>Total</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #64748b;">No existen fichajes registrados en el periodo seleccionado.</td></tr>'}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-label">Firma y Sello de la Empresa</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Firma del Trabajador / Representación Legal</div>
    </div>
  </div>

  <div class="legal-notice">
    <strong>Certificación Legal:</strong> En cumplimiento del artículo 34.9 del Real Decreto Legislativo 2/2015, de 23 de octubre, por el que se aprueba el texto refundido de la Ley del Estatuto de los Trabajadores, la empresa garantiza el registro diario de jornada, que incluye el horario concreto de inicio y finalización de cada jornada de trabajo, sin perjuicio de la flexibilidad horaria que se establezca. FITXAI custodia estos registros durante un periodo no inferior a cuatro años a disposición de las personas trabajadoras, de sus representantes legales y de la Inspección de Trabajo y Seguridad Social.
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlDoc);
  } catch (error: any) {
    console.error('Error exporting PDF document:', error);
    return res.status(500).json({ success: false, error: 'Error al generar documento PDF' });
  }
}
