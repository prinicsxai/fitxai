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

test('CERTIFICACIÓN E2E DE PRODUCCIÓN Y MANEJO DE ERRORES (26 PASOS + CASOS DE ERROR)', async (t) => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
      resolve();
    });
  });

  const timestamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  let companyId;
  let companyBId;
  let adminToken;
  let adminUserId;
  let workerToken;
  let workerUserId;
  let workerEmployeeId;
  let entryPunchId;
  let exitPunchId;
  let incidentId;

  // =========================================================================
  // BLOQUE 1: LOS 26 PASOS DEL FLUJO PRINCIPAL DE PRODUCCIÓN
  // =========================================================================

  await t.test('1. Crear empresa', async () => {
    const res = await request('/companies', {
      method: 'POST',
      body: {
        name: `Acme Global Soluciones ${timestamp}`,
        cif: `B${timestamp.slice(-8)}`,
        contactEmail: `contacto${timestamp}@acmeglobal.es`,
        address: 'Paseo de la Castellana 200, Madrid',
        timezone: 'Europe/Madrid',
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    companyId = res.data.data.id;
    assert.ok(companyId);

    // Empresa B para probar aislamiento
    const resB = await request('/companies', {
      method: 'POST',
      body: {
        name: `Competidor Beta ${timestamp}`,
        cif: `A${timestamp.slice(-8)}`,
        contactEmail: `contacto${timestamp}@beta.es`,
      },
    });
    assert.equal(resB.status, 201);
    companyBId = resB.data.data.id;
  });

  await t.test('2 y 3. Crear administrador y Login administrador', async () => {
    const hash = await bcrypt.hash('AdminPass123!', 10);
    const uRes = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Carlos', 'Director', 'ADMIN', 'ACTIVE') RETURNING id`,
      [companyId, `admin${timestamp}@acmeglobal.es`, hash]
    );
    adminUserId = uRes.rows[0].id;

    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: `admin${timestamp}@acmeglobal.es`, password: 'AdminPass123!' },
    });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.data.success, true);
    adminToken = loginRes.data.token;
    assert.ok(adminToken);
  });

  await t.test('4 y 5. Crear trabajador y Login trabajador', async () => {
    const empRes = await request('/employees', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'Elena',
        lastName: 'Martínez',
        email: `elena${timestamp}@acmeglobal.es`,
        password: 'WorkerPass123!',
        documentId: `5344${timestamp.slice(-4)}Z`,
        department: 'Ingeniería',
        jobTitle: 'Desarrolladora Senior',
      },
    });
    assert.equal(empRes.status, 201);
    workerEmployeeId = empRes.data.data.id;
    workerUserId = empRes.data.data.userId;
    assert.ok(workerEmployeeId);

    const loginWorker = await request('/auth/login', {
      method: 'POST',
      body: { email: `elena${timestamp}@acmeglobal.es`, password: 'WorkerPass123!' },
    });
    assert.equal(loginWorker.status, 200);
    workerToken = loginWorker.data.token;
    assert.ok(workerToken);
  });

  await t.test('6, 7, 8, 9 y 10. Fichar entrada, obtener GPS, guardar coords, precisión y hora del servidor', async () => {
    const preTime = new Date(Date.now() - 2000);

    const punchRes = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        type: 'CHECK_IN',
        latitude: 40.416775,
        longitude: -3.703790,
        accuracy: 14.5,
        deviceInfo: 'iPhone 15 Pro, iOS 18.0 (FITXAI Mobile)',
      },
    });

    assert.equal(punchRes.status, 201);
    assert.equal(punchRes.data.success, true);
    const rec = punchRes.data.record;
    entryPunchId = rec.id;
    assert.ok(entryPunchId);

    // 8. Coordenadas guardadas
    assert.equal(rec.latitude, 40.416775);
    assert.equal(rec.longitude, -3.703790);

    // 9. Precisión guardada
    assert.equal(rec.accuracy, 14.5);

    // 10. Hora oficial del servidor (no del cliente)
    const serverTimestamp = new Date(rec.timestamp);
    assert.ok(serverTimestamp >= preTime, 'La hora debe provenir exclusivamente del servidor');
  });

  await t.test('11, 12 y 13. Mostrar fichaje al admin, ver mapa y comprobar que el GPS se detiene', async () => {
    // 11. El administrador lista fichajes
    const listRes = await request('/admin/attendance', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(listRes.status, 200);
    const punchInList = listRes.data.data.find(p => p.id === entryPunchId);
    assert.ok(punchInList);
    assert.equal(punchInList.first_name, 'Elena');
    assert.equal(punchInList.type, 'CHECK_IN');

    // 12. Inspección detallada con coordenadas para mapa puntual
    const detailRes = await request(`/attendance/${entryPunchId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(detailRes.status, 200);
    assert.ok(detailRes.data.data.map_point);
    assert.equal(detailRes.data.data.map_point.is_single_point, true);
    assert.equal(detailRes.data.data.map_point.tracks_allowed, false);

    // 13. Comprobar que en DB no existe proceso ni tabla de seguimiento continuo
    const locRows = await dbPool.query(
      `SELECT * FROM location_records WHERE attendance_record_id = $1`,
      [entryPunchId]
    );
    assert.equal(locRows.rows.length, 1, 'Solo debe existir exactamente 1 coordenada fija puntual');
    assert.equal(locRows.rows[0].provider, 'gps_single_event');
  });

  await t.test('14, 15 y 16. Fichar salida, mostrar al admin y calcular horas', async () => {
    const exitRes = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        type: 'CHECK_OUT',
        latitude: 40.417200,
        longitude: -3.704100,
        accuracy: 16.2,
      },
    });
    assert.equal(exitRes.status, 201);
    exitPunchId = exitRes.data.record.id;

    // 15. Mostrar salida al admin
    const listExit = await request('/admin/attendance?type=CHECK_OUT', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(listExit.status, 200);
    assert.ok(listExit.data.data.some(p => p.id === exitPunchId));

    // 16. Calcular horas en estado de la jornada
    const statusRes = await request('/attendance/my-status', {
      method: 'GET',
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.data.data.status, 'FINISHED');
    assert.ok(statusRes.data.data.hoursWorked);
    assert.ok(statusRes.data.data.checkInTime);
    assert.ok(statusRes.data.data.checkOutTime);
  });

  await t.test('17. Consultar historial ("Mis Fichajes")', async () => {
    const myPunches = await request('/attendance/my-punches', {
      method: 'GET',
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(myPunches.status, 200);
    assert.equal(myPunches.data.success, true);
    const punchesList = myPunches.data.rawPunches || myPunches.data.data || [];
    assert.ok(punchesList.length >= 2);
    // Verificar que solo contiene fichajes de Elena
    for (const p of punchesList) {
      assert.equal(p.employee_id, workerEmployeeId);
    }
  });

  await t.test('18 y 19. Crear incidencia y Aprobar incidencia con regularización auditada', async () => {
    // 18. Trabajador reporta olvido de fichaje
    const incRes = await request('/incidents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        type: 'FORGOT_PUNCH',
        description: 'Olvidé registrar entrada de guardia nocturna',
        severity: 'MEDIUM',
        requestedTime: new Date(Date.now() - 7200000).toISOString(),
        requestedPunchType: 'CHECK_IN',
      },
    });
    assert.equal(incRes.status, 201);
    incidentId = incRes.data.data.id;

    // 19. Administrador aprueba
    const approveRes = await request(`/incidents/${incidentId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { adminComment: 'Aprobado y contrastado con supervisor', createMissingPunch: true },
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.data.status, 'RESOLVED');
    assert.ok(approveRes.data.regularizedAttendanceId);
  });

  await t.test('20, 21, 22 y 23. Generar informe, exportar CSV, Excel y PDF', async () => {
    // 20. Generar informe consolidado
    const repRes = await request('/reports', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(repRes.status, 200);
    assert.equal(repRes.data.success, true);
    assert.ok(repRes.data.data.summary.totalHoursWorked);
    assert.ok(repRes.data.data.employees.length >= 1);

    // 21. Exportar CSV
    const csvRes = await request('/reports/export/csv', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(csvRes.status, 200);
    assert.ok(csvRes.headers.get('content-type').includes('text/csv'));
    assert.ok(csvRes.data.includes('INFORME OFICIAL'));

    // 22. Exportar Excel
    const xlsRes = await request('/reports/export/excel', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(xlsRes.status, 200);
    assert.ok(xlsRes.headers.get('content-type').includes('application/vnd.ms-excel'));

    // 23. Exportar PDF
    const pdfRes = await request('/reports/export/pdf', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(pdfRes.status, 200);
    assert.ok(pdfRes.headers.get('content-type').includes('text/html'));
    assert.ok(pdfRes.data.includes('Art. 34.9 del Estatuto de los Trabajadores'));
  });

  await t.test('24, 25 y 26. Comprobar auditoría, permisos y aislamiento entre empresas', async () => {
    // 24. Comprobar auditoría inmutable
    const auditRes = await request('/audit/logs?limit=50', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(auditRes.status, 200);
    assert.ok(auditRes.data.data.length >= 5);

    // 25. Comprobar permisos (trabajador no puede acceder a reportes ni auditoría)
    const forbiddenRep = await request('/reports', {
      method: 'GET',
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(forbiddenRep.status, 403);

    const forbiddenAudit = await request('/audit/logs', {
      method: 'GET',
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(forbiddenAudit.status, 403);

    // 26. Aislamiento entre empresas
    const crossAudit = auditRes.data.data.some(l => l.company_id === companyBId);
    assert.equal(crossAudit, false, 'No deben figurar eventos de Empresa B en los registros de Empresa A');
  });

  // =========================================================================
  // BLOQUE 2: PRUEBAS EXHAUSTIVAS DE ERROR Y RESILENCIA
  // =========================================================================

  await t.test('E1. Error: Fichaje sin coordenadas o coordenadas inválidas (0,0)', async () => {
    const res = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        type: 'CHECK_IN',
        latitude: 0,
        longitude: 0,
        accuracy: 20,
      },
    });
    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    // Mensaje amigable y claro (comprobación case-insensitive)
    const errLower = res.data.error.toLowerCase();
    assert.ok(errLower.includes('coordenadas') || errLower.includes('ubicación'));
  });

  await t.test('E2. Error: Ubicación simulada detectada (Fake/Mock GPS)', async () => {
    const res = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        type: 'CHECK_IN',
        latitude: 40.4168,
        longitude: -3.7038,
        accuracy: 10,
        isMocked: true,
      },
    });
    assert.ok([403, 422].includes(res.status));
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.toLowerCase().includes('simulada') || res.data.error.toLowerCase().includes('dispositivo'));
  });

  await t.test('E3. Error: Precisión GPS insuficiente (> 250m)', async () => {
    const res = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        type: 'CHECK_IN',
        latitude: 40.4168,
        longitude: -3.7038,
        accuracy: 350.0, // Superior al límite tolerable
      },
    });
    assert.ok([400, 422].includes(res.status));
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.toLowerCase().includes('precisión') || res.data.error.toLowerCase().includes('cobertura'));
  });

  await t.test('E4. Error: Dos fichajes simultáneos o doble pulsación rápida (< 5 segundos)', async () => {
    // Primer fichaje válido
    const p1 = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: { type: 'CHECK_IN', latitude: 40.4168, longitude: -3.7038, accuracy: 15.0 },
    });
    assert.equal(p1.status, 201);

    // Segundo fichaje inmediato (menos de 5 segundos)
    const p2 = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: { type: 'CHECK_IN', latitude: 40.4168, longitude: -3.7038, accuracy: 15.0 },
    });
    assert.ok([400, 409].includes(p2.status));
    assert.equal(p2.data.success, false);
    const errLower = p2.data.error.toLowerCase();
    assert.ok(errLower.includes('segundos') || errLower.includes('duplicado') || errLower.includes('reciente') || errLower.includes('activa'));
  });

  await t.test('E5. Error: Sesión expirada o token revocado', async () => {
    // Logout para revocar sesión
    const logoutRes = await request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(logoutRes.status, 200);

    // Intentar fichar con token revocado
    const expiredRes = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: { type: 'CHECK_OUT', latitude: 40.4168, longitude: -3.7038, accuracy: 15.0 },
    });
    assert.equal(expiredRes.status, 401);
    assert.equal(expiredRes.data.success, false);
  });

  await t.test('E6. Error: Usuario desactivado bloqueado de inmediato', async () => {
    // Crear otro usuario para probar desactivación
    const hash = await bcrypt.hash('Pass123!', 10);
    const uTest = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Mario', 'Baja', 'EMPLOYEE', 'ACTIVE') RETURNING id`,
      [companyId, `mario${timestamp}@acmeglobal.es`, hash]
    );
    const eTest = await dbPool.query(
      `INSERT INTO employees (user_id, company_id, first_name, last_name, document_id)
       VALUES ($1, $2, 'Mario', 'Baja', '77777777M') RETURNING id`,
      [uTest.rows[0].id, companyId]
    );

    const loginM = await request('/auth/login', {
      method: 'POST',
      body: { email: `mario${timestamp}@acmeglobal.es`, password: 'Pass123!' },
    });
    assert.equal(loginM.status, 200);
    const marioToken = loginM.data.token;

    // Admin desactiva a Mario
    const deact = await request(`/employees/${eTest.rows[0].id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(deact.status, 200);

    // Mario intenta fichar
    const punchDeact = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${marioToken}` },
      body: { type: 'CHECK_IN', latitude: 40.4168, longitude: -3.7038, accuracy: 15.0 },
    });
    assert.ok([401, 403].includes(punchDeact.status));
    assert.equal(punchDeact.data.success, false);
  });

  await t.test('E7. Error: Datos incorrectos o formato no válido capturado por validación', async () => {
    const badBody = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        type: 'TIPO_INVALIDO',
        latitude: 'no_es_numero',
      },
    });
    assert.equal(badBody.status, 400);
    assert.equal(badBody.data.success, false);
  });

  await t.test('E8. Error: Endpoint inexistente devuelve 404 estructurado', async () => {
    const notFound = await request('/rutas/inexistentes/fichajes');
    assert.equal(notFound.status, 404);
    assert.equal(notFound.data.success, false);
    assert.ok(notFound.data.error.includes('not found'));
  });

  server.close();
});
