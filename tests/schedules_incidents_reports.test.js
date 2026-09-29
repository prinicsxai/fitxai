const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const { app } = require('../backend/dist/app');
const { dbPool } = require('../backend/dist/db/pool');

let server;
let baseUrl;

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = { ...options.headers };
  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, headers: res.headers, data };
}

test('SISTEMA EMPRESARIAL: HORARIOS, INCIDENCIAS, ANOMALÍAS E INFORMES (PARTE 7)', async (t) => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
      resolve();
    });
  });

  const timestamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  let companyId;
  let adminToken;
  let adminUserId;
  let workerToken;
  let workerUserId;
  let workerEmployeeId;
  let scheduleId;
  let forgotIncidentId;
  let rejectedIncidentId;

  await t.test('1. Setup Empresa, Admin y Trabajador', async () => {
    const hash = await bcrypt.hash('Password123!', 10);

    const compRes = await request('/companies', {
      method: 'POST',
      body: {
        name: `Acme Corp ${timestamp}`,
        cif: `B${timestamp.slice(-8)}`,
        contactEmail: `admin@acme-${timestamp}.es`,
        address: 'Paseo de la Castellana 100, Madrid',
      },
    });
    assert.equal(compRes.status, 201);
    companyId = compRes.data.data.id;

    // Admin
    const adminUserRes = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Carlos', 'Gerente', 'ADMIN', 'ACTIVE')
       RETURNING id`,
      [companyId, `admin-${timestamp}@acme.es`, hash]
    );
    adminUserId = adminUserRes.rows[0].id;

    // Worker
    const workerUserRes = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Laura', 'Gómez', 'EMPLOYEE', 'ACTIVE')
       RETURNING id`,
      [companyId, `laura-${timestamp}@acme.es`, hash]
    );
    workerUserId = workerUserRes.rows[0].id;

    const empRes = await dbPool.query(
      `INSERT INTO employees (user_id, company_id, first_name, last_name, document_id, employee_code, department, job_title)
       VALUES ($1, $2, 'Laura', 'Gómez', '48765432W', 'EMP-007', 'Operaciones', 'Técnica de Soporte')
       RETURNING id`,
      [workerUserId, companyId]
    );
    workerEmployeeId = empRes.rows[0].id;

    // Login Admin
    const loginAdmin = await request('/auth/login', {
      method: 'POST',
      body: { email: `admin-${timestamp}@acme.es`, password: 'Password123!' },
    });
    assert.equal(loginAdmin.status, 200);
    adminToken = loginAdmin.data.token;

    // Login Worker
    const loginWorker = await request('/auth/login', {
      method: 'POST',
      body: { email: `laura-${timestamp}@acme.es`, password: 'Password123!' },
    });
    assert.equal(loginWorker.status, 200);
    workerToken = loginWorker.data.token;
  });

  await t.test('2. Gestión de Horarios: Crear, Listar, Actualizar y Asignar', async () => {
    // 2.1 Crear horario
    const createRes = await request('/schedules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Turno de Mañana Estándar',
        startTime: '08:00',
        endTime: '16:30',
        workDays: 'L,M,X,J,V',
        breakMinutes: 30,
        breakStart: '13:00',
        breakEnd: '13:30',
        employeeId: workerEmployeeId,
      },
    });

    assert.equal(createRes.status, 201);
    assert.equal(createRes.data.success, true);
    assert.equal(createRes.data.data.name, 'Turno de Mañana Estándar');
    scheduleId = createRes.data.data.id;

    // 2.2 Listar horarios
    const listRes = await request('/schedules', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(listRes.status, 200);
    assert.ok(listRes.data.data.length >= 1);
    const found = listRes.data.data.find(s => s.id === scheduleId);
    assert.ok(found);
    assert.equal(found.first_name, 'Laura');

    // 2.3 Modificar horario
    const updateRes = await request(`/schedules/${scheduleId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        endTime: '17:00',
        breakMinutes: 45,
      },
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.data.end_time, '17:00');
    assert.equal(updateRes.data.data.break_minutes, 45);

    // 2.4 Comprobar registro de auditoría
    const auditRes = await dbPool.query(
      `SELECT * FROM audit_logs WHERE company_id = $1 AND entity_id = $2`,
      [companyId, scheduleId]
    );
    assert.ok(auditRes.rows.length >= 2); // SCHEDULE_CREATED y SCHEDULE_UPDATED
  });

  await t.test('3. Ciclo de Incidencias: Reporte de Fichaje Olvidado, Revisión y Regularización Auditada', async () => {
    // 3.1 Trabajador crea incidencia "He olvidado fichar" con hora solicitada
    const forgotDate = new Date();
    forgotDate.setHours(8, 0, 0, 0);

    const createIncRes = await request('/incidents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        type: 'FORGOT_PUNCH',
        description: 'Olvidé fichar la entrada a las 08:00 debido a una llamada urgente de cliente.',
        severity: 'MEDIUM',
        requestedTime: forgotDate.toISOString(),
        requestedPunchType: 'CHECK_IN',
      },
    });

    assert.equal(createIncRes.status, 201);
    assert.equal(createIncRes.data.success, true);
    assert.equal(createIncRes.data.data.type, 'FORGOT_PUNCH');
    assert.equal(createIncRes.data.data.status, 'PENDING');
    forgotIncidentId = createIncRes.data.data.id;

    // 3.2 El administrador revisa y comenta la incidencia
    const reviewRes = await request(`/incidents/${forgotIncidentId}/review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        adminComment: 'Comprobando actividad con el supervisor de operaciones.',
      },
    });
    assert.equal(reviewRes.status, 200);
    assert.equal(reviewRes.data.data.status, 'REVIEWED');

    // 3.3 El administrador aprueba la incidencia y regulariza el fichaje automáticamente
    const approveRes = await request(`/incidents/${forgotIncidentId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        adminComment: 'Aprobado tras confirmar con el cliente. Se genera entrada a las 08:00.',
        createMissingPunch: true,
      },
    });

    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.data.status, 'RESOLVED');
    assert.ok(approveRes.data.regularizedAttendanceId);

    // 3.4 Verificar que el fichaje fue creado en la base de datos
    const regularizedPunch = await dbPool.query(
      `SELECT * FROM attendance_records WHERE id = $1`,
      [approveRes.data.regularizedAttendanceId]
    );
    assert.equal(regularizedPunch.rows.length, 1);
    assert.equal(regularizedPunch.rows[0].type, 'CHECK_IN');

    // 3.5 Incidencia rechazada: Trabajador reporta problema y admin rechaza con motivo
    const rejectIncRes = await request('/incidents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        type: 'PUNCH_ERROR',
        description: 'Fiché entrada dos veces por confusión.',
        severity: 'LOW',
      },
    });
    assert.equal(rejectIncRes.status, 201);
    rejectedIncidentId = rejectIncRes.data.data.id;

    const rejectActionRes = await request(`/incidents/${rejectedIncidentId}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        adminComment: 'No procede rectificación, el duplicado se filtra en el cómputo horario.',
      },
    });
    assert.equal(rejectActionRes.status, 200);
    assert.equal(rejectActionRes.data.data.status, 'DISMISSED');
    assert.equal(rejectActionRes.data.data.admin_comment, 'No procede rectificación, el duplicado se filtra en el cómputo horario.');
  });

  await t.test('4. Cómputo de Horas y Detección de Anomalías (Report Engine)', async () => {
    // Insertamos fichajes para probar las 4 anomalías exigidas:
    // 1. Turno normal: Entrada 08:00, Salida 16:30 (8.5h)
    // 2. Fichaje duplicado: Entrada 16:32 (a los 2 minutos)
    // 3. Jornada anormalmente larga: Entrada 07:00, Salida 20:00 (13h > 10h)
    // 4. Salida sin entrada (ORPHAN_CHECK_OUT)
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 5);

    const day1_in = new Date(baseDate); day1_in.setHours(8, 0, 0, 0);
    const day1_out = new Date(baseDate); day1_out.setHours(16, 30, 0, 0);
    const day1_dup = new Date(baseDate); day1_dup.setHours(16, 32, 0, 0); // duplicate CHECK_OUT

    const day2 = new Date(baseDate); day2.setDate(day2.getDate() + 1);
    const day2_in = new Date(day2); day2_in.setHours(7, 0, 0, 0);
    const day2_out = new Date(day2); day2_out.setHours(20, 0, 0, 0); // 13h > 10h OVERLONG_SHIFT

    const day3 = new Date(baseDate); day3.setDate(day3.getDate() + 2);
    const day3_orphan_out = new Date(day3); day3_orphan_out.setHours(18, 0, 0, 0); // ORPHAN_CHECK_OUT

    const day4 = new Date(baseDate); day4.setDate(day4.getDate() + 3);
    const day4_unclosed_in = new Date(day4); day4_unclosed_in.setHours(9, 0, 0, 0); // UNCLOSED_CHECK_IN

    // Insertar registros
    await dbPool.query(
      `INSERT INTO attendance_records (employee_id, company_id, type, timestamp, status) VALUES
       ($1, $2, 'CHECK_IN', $3, 'VERIFIED'),
       ($1, $2, 'CHECK_OUT', $4, 'VERIFIED'),
       ($1, $2, 'CHECK_OUT', $5, 'VERIFIED'),
       ($1, $2, 'CHECK_IN', $6, 'VERIFIED'),
       ($1, $2, 'CHECK_OUT', $7, 'VERIFIED'),
       ($1, $2, 'CHECK_OUT', $8, 'VERIFIED'),
       ($1, $2, 'CHECK_IN', $9, 'VERIFIED')`,
      [
        workerEmployeeId,
        companyId,
        day1_in,
        day1_out,
        day1_dup,
        day2_in,
        day2_out,
        day3_orphan_out,
        day4_unclosed_in,
      ]
    );

    // Consultar informe detallado
    const repRes = await request(`/reports?employeeId=${workerEmployeeId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(repRes.status, 200);
    assert.equal(repRes.data.success, true);

    const reportData = repRes.data.data;
    assert.ok(reportData.employees.length > 0);

    const empReport = reportData.employees.find(e => e.employeeId === workerEmployeeId);
    assert.ok(empReport);

    // Verificar cálculo de horas
    assert.ok(empReport.totalDurationMinutes > 0);
    assert.ok(empReport.totalHoursDecimal > 0);
    assert.ok(Object.keys(empReport.dailyHours).length >= 2);
    assert.ok(Object.keys(empReport.weeklyHours).length >= 1);
    assert.ok(Object.keys(empReport.monthlyHours).length >= 1);

    // Verificar detección de anomalías
    const anomalyTypes = empReport.anomalies.map(a => a.type);
    assert.ok(anomalyTypes.includes('DUPLICATE_PUNCH'), 'Debe detectar fichajes duplicados');
    assert.ok(anomalyTypes.includes('OVERLONG_SHIFT'), 'Debe detectar jornadas anormalmente largas');
    assert.ok(anomalyTypes.includes('ORPHAN_CHECK_OUT'), 'Debe detectar salidas sin entrada');
    assert.ok(anomalyTypes.includes('UNCLOSED_CHECK_IN'), 'Debe detectar entradas sin salida');
    assert.ok(empReport.incompletePunchesCount >= 2);
  });

  await t.test('5. Exportaciones: CSV (UTF-8 BOM), Excel (Spreadsheet XML) y PDF Oficial (Art. 34.9 ET)', async () => {
    // 5.1 Exportación CSV
    const csvRes = await request('/reports/export/csv', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(csvRes.status, 200);
    assert.ok(csvRes.headers.get('content-type').includes('text/csv'));
    assert.ok(csvRes.headers.get('content-disposition').includes('attachment; filename='));
    // Verificar contenido esencial de la exportación CSV
    assert.ok(csvRes.data.includes('INFORME OFICIAL DE REGISTRO DE JORNADA LABORAL'));
    assert.ok(csvRes.data.includes('Laura Gómez'));
    assert.ok(csvRes.data.includes('48765432W'));

    // 5.2 Exportación Excel
    const xlsRes = await request('/reports/export/excel', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(xlsRes.status, 200);
    assert.ok(xlsRes.headers.get('content-type').includes('application/vnd.ms-excel'));
    assert.ok(xlsRes.data.includes('urn:schemas-microsoft-com:office:spreadsheet'));
    assert.ok(xlsRes.data.includes('Laura Gómez'));

    // 5.3 Exportación PDF Documento Oficial
    const pdfRes = await request('/reports/export/pdf', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(pdfRes.status, 200);
    assert.ok(pdfRes.headers.get('content-type').includes('text/html'));
    assert.ok(pdfRes.data.includes('Registro Oficial de Jornada de Trabajo'));
    assert.ok(pdfRes.data.includes('Art. 34.9 del Estatuto de los Trabajadores'));
    assert.ok(pdfRes.data.includes('Firma y Sello de la Empresa'));
    assert.ok(pdfRes.data.includes('Firma del Trabajador'));
  });

  await t.test('6. Eliminación de Horario con Auditoría', async () => {
    const delRes = await request(`/schedules/${scheduleId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.data.success, true);

    const check = await dbPool.query(`SELECT * FROM work_schedules WHERE id = $1`, [scheduleId]);
    assert.equal(check.rows.length, 0);

    const auditDel = await dbPool.query(
      `SELECT * FROM audit_logs WHERE company_id = $1 AND entity_id = $2 AND action = 'SCHEDULE_DELETED'`,
      [companyId, scheduleId]
    );
    assert.equal(auditDel.rows.length, 1);
  });

  server.close();
});
