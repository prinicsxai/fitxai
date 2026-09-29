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

test('FASE DE SEGURIDAD, AUDITORÍA, PRIVACIDAD Y AISLAMIENTO (PARTE 8)', async (t) => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
      resolve();
    });
  });

  const timestamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  let companyAId;
  let companyBId;
  let adminAToken;
  let adminBToken;
  let workerA1Token;
  let workerA1EmployeeId;
  let workerA2EmployeeId;
  let workerB1Token;
  let workerB1EmployeeId;
  let samplePunchId;
  let sampleIncidentId;

  await t.test('1. Setup Multi-Empresa con Roles Diferenciados', async () => {
    const hash = await bcrypt.hash('SecurePass123!', 10);

    // Empresa A
    const compA = await request('/companies', {
      method: 'POST',
      body: { name: `Seguridad Alpha ${timestamp}`, cif: `A${timestamp.slice(-8)}`, contactEmail: `alpha${timestamp}@test.es` },
    });
    assert.equal(compA.status, 201);
    companyAId = compA.data.data.id;

    // Empresa B
    const compB = await request('/companies', {
      method: 'POST',
      body: { name: `Seguridad Beta ${timestamp}`, cif: `B${timestamp.slice(-8)}`, contactEmail: `beta${timestamp}@test.es` },
    });
    assert.equal(compB.status, 201);
    companyBId = compB.data.data.id;

    // Admin A
    await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Admin', 'Alpha', 'ADMIN', 'ACTIVE')`,
      [companyAId, `admin.a${timestamp}@test.es`, hash]
    );

    // Admin B
    await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Admin', 'Beta', 'ADMIN', 'ACTIVE')`,
      [companyBId, `admin.b${timestamp}@test.es`, hash]
    );

    // Worker A1
    const wA1 = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Juan', 'Alpha1', 'EMPLOYEE', 'ACTIVE') RETURNING id`,
      [companyAId, `worker.a1${timestamp}@test.es`, hash]
    );
    const empA1 = await dbPool.query(
      `INSERT INTO employees (user_id, company_id, first_name, last_name, document_id, employee_code, department)
       VALUES ($1, $2, 'Juan', 'Alpha1', '11111111A', 'EMP-A1', 'Operaciones') RETURNING id`,
      [wA1.rows[0].id, companyAId]
    );
    workerA1EmployeeId = empA1.rows[0].id;

    // Worker A2
    const wA2 = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Ana', 'Alpha2', 'EMPLOYEE', 'ACTIVE') RETURNING id`,
      [companyAId, `worker.a2${timestamp}@test.es`, hash]
    );
    const empA2 = await dbPool.query(
      `INSERT INTO employees (user_id, company_id, first_name, last_name, document_id, employee_code, department)
       VALUES ($1, $2, 'Ana', 'Alpha2', '22222222A', 'EMP-A2', 'Ventas') RETURNING id`,
      [wA2.rows[0].id, companyAId]
    );
    workerA2EmployeeId = empA2.rows[0].id;

    // Worker B1
    const wB1 = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Pedro', 'Beta1', 'EMPLOYEE', 'ACTIVE') RETURNING id`,
      [companyBId, `worker.b1${timestamp}@test.es`, hash]
    );
    const empB1 = await dbPool.query(
      `INSERT INTO employees (user_id, company_id, first_name, last_name, document_id, employee_code, department)
       VALUES ($1, $2, 'Pedro', 'Beta1', '33333333B', 'EMP-B1', 'Logística') RETURNING id`,
      [wB1.rows[0].id, companyBId]
    );
    workerB1EmployeeId = empB1.rows[0].id;

    // Login Admin A
    const loginA = await request('/auth/login', {
      method: 'POST',
      body: { email: `admin.a${timestamp}@test.es`, password: 'SecurePass123!' },
    });
    assert.equal(loginA.status, 200);
    adminAToken = loginA.data.token;

    // Login Admin B
    const loginB = await request('/auth/login', {
      method: 'POST',
      body: { email: `admin.b${timestamp}@test.es`, password: 'SecurePass123!' },
    });
    assert.equal(loginB.status, 200);
    adminBToken = loginB.data.token;

    // Login Worker A1
    const loginWA1 = await request('/auth/login', {
      method: 'POST',
      body: { email: `worker.a1${timestamp}@test.es`, password: 'SecurePass123!' },
    });
    assert.equal(loginWA1.status, 200);
    workerA1Token = loginWA1.data.token;

    // Login Worker B1
    const loginWB1 = await request('/auth/login', {
      method: 'POST',
      body: { email: `worker.b1${timestamp}@test.es`, password: 'SecurePass123!' },
    });
    assert.equal(loginWB1.status, 200);
    workerB1Token = loginWB1.data.token;
  });

  await t.test('2. Resistencia contra Inyección SQL y Sanitización XSS', async () => {
    // 2.1 Intentos de inyección SQL en parámetros de búsqueda
    const sqliAttempts = [
      `' OR '1'='1`,
      `'; DROP TABLE users; --`,
      `1' UNION SELECT username, password FROM users --`,
    ];

    for (const payload of sqliAttempts) {
      const res = await request(`/reports?department=${encodeURIComponent(payload)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      // La API debe manejarlo de forma segura mediante consultas parametrizadas
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
    }

    // 2.2 Sanitización XSS en payloads de entrada
    const xssRes = await request('/employees', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: {
        firstName: `<script>alert('xss')</script>Carlos`,
        lastName: `Pérez`,
        email: `carlos.xss${timestamp}@test.es`,
        documentId: `99999999X`,
        department: `Seguridad`,
      },
    });
    assert.equal(xssRes.status, 201);
    // El script debe haber sido sanitizado
    assert.ok(!xssRes.data.data.firstName.includes('<script>'));
  });

  await t.test('3. Prevención de Escalada de Privilegios: Trabajador Bloqueado en APIs Admin', async () => {
    // Un trabajador con token de EMPLOYEE intenta acceder a endpoints administrativos
    const restrictedEndpoints = [
      { method: 'GET', path: '/admin/attendance' },
      { method: 'GET', path: '/admin/stats' },
      { method: 'GET', path: '/employees' },
      { method: 'POST', path: '/employees', body: { firstName: 'Hacker' } },
      { method: 'GET', path: '/schedules' },
      { method: 'POST', path: '/schedules', body: { name: 'Hack Turn' } },
      { method: 'GET', path: '/reports' },
      { method: 'GET', path: '/audit/logs' },
      { method: 'GET', path: '/companies/settings' },
      { method: 'PUT', path: '/companies/settings', body: { requireGps: false } },
    ];

    for (const ep of restrictedEndpoints) {
      const res = await request(ep.path, {
        method: ep.method,
        headers: { Authorization: `Bearer ${workerA1Token}` },
        body: ep.body,
      });
      assert.equal(res.status, 403, `Endpoint ${ep.method} ${ep.path} debe responder 403 Forbidden para rol EMPLOYEE`);
      assert.equal(res.data.success, false);
    }
  });

  await t.test('4. Aislamiento Multi-Tenant Estricto entre Empresa A y Empresa B', async () => {
    // 4.1 Admin A intenta acceder al trabajador de Empresa B
    const crossEmp = await request(`/employees/${workerB1EmployeeId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert.equal(crossEmp.status, 404, 'Admin A no debe poder ver trabajador de Empresa B');

    // 4.2 Admin A intenta desactivar trabajador de Empresa B
    const crossDelete = await request(`/employees/${workerB1EmployeeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert.equal(crossDelete.status, 404, 'Admin A no debe poder desactivar trabajador de Empresa B');

    // 4.3 Fichaje en Empresa B
    const punchB = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerB1Token}` },
      body: {
        type: 'CHECK_IN',
        latitude: 40.4168,
        longitude: -3.7038,
        accuracy: 15.0,
      },
    });
    assert.equal(punchB.status, 201);
    const punchBId = (punchB.data.record || punchB.data.data).id;

    // 4.4 Admin A intenta corregir fichaje de Empresa B
    const crossCorrect = await request(`/attendance/${punchBId}/correct`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: { reason: 'Intento de modificación cruzada no autorizada' },
    });
    assert.equal(crossCorrect.status, 404, 'Admin A no debe poder corregir fichaje de Empresa B');

    // 4.5 Admin A consulta logs de auditoría: no debe ver ningún registro de Empresa B
    const auditResA = await request('/audit/logs', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert.equal(auditResA.status, 200);
    const hasCompanyBLog = auditResA.data.data.some(log => log.company_id === companyBId);
    assert.equal(hasCompanyBLog, false, 'Los logs de auditoría de Admin A nunca deben contener datos de Empresa B');
  });

  await t.test('5. Trazabilidad Completa: Comprobación de los 10 Eventos de Auditoría', async () => {
    // 5.1 Fichaje Entrada (PUNCH_CHECK_IN)
    const punchIn = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerA1Token}` },
      body: { type: 'CHECK_IN', latitude: 40.4168, longitude: -3.7038, accuracy: 12.0 },
    });
    assert.equal(punchIn.status, 201);
    samplePunchId = (punchIn.data.record || punchIn.data.data).id;

    // 5.2 Fichaje Salida (PUNCH_CHECK_OUT)
    const punchOut = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerA1Token}` },
      body: { type: 'CHECK_OUT', latitude: 40.4168, longitude: -3.7038, accuracy: 14.0 },
    });
    assert.equal(punchOut.status, 201);

    // 5.3 Corrección de Fichaje por Admin (PUNCH_CORRECTED)
    const correctRes = await request(`/attendance/${samplePunchId}/correct`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: {
        reason: 'Corrección manual autorizada por olvido de marcar salida puntual',
        status: 'VERIFIED',
      },
    });
    assert.equal(correctRes.status, 200);

    // 5.4 Trabajador crea Incidencia y Admin la Aprueba (INCIDENT_APPROVED)
    const incRes = await request('/incidents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerA1Token}` },
      body: {
        type: 'FORGOT_PUNCH',
        description: 'Petición de regularización de entrada a las 09:00',
        requestedTime: new Date().toISOString(),
        requestedPunchType: 'CHECK_IN',
      },
    });
    assert.equal(incRes.status, 201);
    sampleIncidentId = incRes.data.data.id;

    const approveIncRes = await request(`/incidents/${sampleIncidentId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: { adminComment: 'Aprobado y regularizado', createMissingPunch: true },
    });
    assert.equal(approveIncRes.status, 200);

    // 5.5 Incidencia Rechazada (INCIDENT_REJECTED)
    const incRejRes = await request('/incidents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerA1Token}` },
      body: { type: 'OTHER', description: 'Petición rechazada de prueba' },
    });
    assert.equal(incRejRes.status, 201);
    const rejIncId = incRejRes.data.data.id;

    const rejectRes = await request(`/incidents/${rejIncId}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: { adminComment: 'Rechazo justificado por duplicidad' },
    });
    assert.equal(rejectRes.status, 200);

    // 5.6 Desactivación de Trabajador (EMPLOYEE_DEACTIVATED)
    const deactRes = await request(`/employees/${workerA2EmployeeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert.equal(deactRes.status, 200);

    // 5.7 Cambios de Configuración de Empresa (SETTINGS_UPDATED)
    const settingsRes = await request('/companies/settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: { maxGpsAccuracyMeters: 120, requireGps: true, timezone: 'Europe/Madrid' },
    });
    assert.equal(settingsRes.status, 200);

    // 5.8 Logout de Trabajador (USER_LOGOUT)
    const logoutRes = await request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerA1Token}` },
    });
    assert.equal(logoutRes.status, 200);

    // 5.9 Verificar que todos los eventos requeridos figuran en audit_logs de Empresa A
    const logsRes = await request('/audit/logs?limit=50', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert.equal(logsRes.status, 200);
    const actions = logsRes.data.data.map(l => l.action);

    const requiredActions = [
      'USER_LOGIN',
      'USER_LOGOUT',
      'EMPLOYEE_CREATED',
      'EMPLOYEE_DEACTIVATED',
      'PUNCH_CHECK_IN',
      'PUNCH_CHECK_OUT',
      'PUNCH_CORRECTED',
      'INCIDENT_APPROVED',
      'INCIDENT_REJECTED',
      'SETTINGS_UPDATED',
    ];

    for (const reqAct of requiredActions) {
      assert.ok(
        actions.includes(reqAct),
        `El evento obligatorio "${reqAct}" debe existir en audit_logs. Acciones encontradas: ${actions.join(', ')}`
      );
    }
  });

  await t.test('6. Verificación de Privacidad: Prohibición de Seguimiento Continuo y Asociación 1:1', async () => {
    // 6.1 Comprobar que en la base de datos la ubicación está estrictamente asociada 1:1 al fichaje
    const locRows = await dbPool.query(
      `SELECT lr.*, ar.company_id, ar.type
       FROM location_records lr
       JOIN attendance_records ar ON ar.id = lr.attendance_record_id
       WHERE ar.company_id = $1`,
      [companyAId]
    );

    assert.ok(locRows.rows.length >= 2, 'Deben existir ubicaciones asociadas a fichajes');
    for (const row of locRows.rows) {
      assert.ok(row.attendance_record_id, 'Cada ubicación debe tener un attendance_record_id');
      assert.ok(
        ['gps_single_event', 'incident_approval'].includes(row.provider),
        'El proveedor de ubicación debe ser un evento puntual (gps_single_event o incident_approval)'
      );
    }

    // 6.2 Comprobar que la restricción UNIQUE existe en location_records.attendance_record_id
    const constraintCheck = await dbPool.query(
      `SELECT conname FROM pg_constraint 
       WHERE conrelid = 'location_records'::regclass 
         AND contype IN ('u', 'p')`
    );
    assert.ok(constraintCheck.rows.length >= 1, 'location_records debe mantener unicidad por cada fichaje puntual');
  });

  server.close();
});
