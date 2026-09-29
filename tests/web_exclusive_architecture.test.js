const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { app } = require('../backend/dist/app');
const { dbPool } = require('../backend/dist/db/pool');

let server;
let baseUrl;

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

test('ARQUITECTURA 100% EXCLUSIVA WEB - TRABAJADOR Y ADMINISTRADOR', async (t) => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
      resolve();
    });
  });

  const timestamp = Date.now();
  let companyId;
  let adminToken;
  let workerToken;
  let workerEmployeeId;

  await t.test('1. Verificación de Ausencia Total de Código Nativo Móvil', () => {
    const mobileDirExists = fs.existsSync(path.join(__dirname, '../mobile'));
    assert.equal(mobileDirExists, false, 'El directorio mobile/ debe estar completamente eliminado');

    const rootPackage = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    assert.ok(!rootPackage.workspaces.includes('mobile'), 'El workspace mobile no debe existir en package.json');
    assert.equal(rootPackage.scripts['dev:mobile'], undefined, 'El script dev:mobile debe haber sido eliminado');
  });

  await t.test('2. Creación de Empresa, Administrador y Trabajador', async () => {
    // Crear Empresa
    const compRes = await request('/companies', {
      method: 'POST',
      body: {
        name: `Web Only Logistics ${timestamp}`,
        cif: `B${timestamp.toString().slice(-8)}`,
        contactEmail: `admin-${timestamp}@webonly.es`,
      },
    });
    assert.equal(compRes.status, 201);
    companyId = compRes.data.data.id;

    // Crear Admin
    const bcrypt = require('bcryptjs');
    const hashAdmin = await bcrypt.hash('AdminWeb123!', 10);
    await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Admin', 'Web', 'ADMIN', 'ACTIVE')`,
      [companyId, `admin-${timestamp}@webonly.es`, hashAdmin]
    );

    // Login Admin
    const loginAdminRes = await request('/auth/login', {
      method: 'POST',
      body: { email: `admin-${timestamp}@webonly.es`, password: 'AdminWeb123!' },
    });
    assert.equal(loginAdminRes.status, 200);
    adminToken = loginAdminRes.data.token;

    // Crear Trabajador
    const hashWorker = await bcrypt.hash('WorkerWeb123!', 10);
    const uRes = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Laura', 'Gómez', 'EMPLOYEE', 'ACTIVE')
       RETURNING id`,
      [companyId, `laura.worker-${timestamp}@webonly.es`, hashWorker]
    );
    const workerUserId = uRes.rows[0].id;

    const eRes = await dbPool.query(
      `INSERT INTO employees (user_id, company_id, first_name, last_name, document_id, employee_code, department, job_title, hire_date, is_active)
       VALUES ($1, $2, 'Laura', 'Gómez', '44556677W', 'EMP-WEB-01', 'Logística', 'Operaria Web', CURRENT_DATE, true)
       RETURNING id`,
      [workerUserId, companyId]
    );
    workerEmployeeId = eRes.rows[0].id;

    // Login Trabajador
    const loginWorkerRes = await request('/auth/login', {
      method: 'POST',
      body: { email: `laura.worker-${timestamp}@webonly.es`, password: 'WorkerWeb123!' },
    });
    assert.equal(loginWorkerRes.status, 200);
    assert.equal(loginWorkerRes.data.user.role, 'EMPLOYEE');
    workerToken = loginWorkerRes.data.token;
  });

  await t.test('3. Trabajador Consulta Estado Inicial Web: NO HAS FICHADO', async () => {
    const res = await request('/attendance/my-status', {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.data.status, 'NOT_STARTED');
    assert.equal(res.data.data.statusText, 'NO HAS FICHADO');
    assert.equal(res.data.data.actionButton, 'FICHAR ENTRADA');
  });

  await t.test('4. Fichar ENTRADA Web mediante POST /attendance/check-in', async () => {
    const res = await request('/attendance/check-in', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        latitude: 41.3879,
        longitude: 2.1699,
        accuracy: 15.2,
        deviceInfo: 'Safari iOS / Web Browser',
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.equal(res.data.record.type, 'CHECK_IN');
    assert.equal(res.data.record.latitude, 41.3879);
    assert.equal(res.data.record.longitude, 2.1699);
  });

  await t.test('5. Estado Web tras Entrada: JORNADA ACTIVA', async () => {
    const res = await request('/attendance/my-status', {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.data.status, 'ACTIVE');
    assert.equal(res.data.data.statusText, 'JORNADA ACTIVA');
    assert.equal(res.data.data.actionButton, 'FICHAR SALIDA');
    assert.ok(res.data.data.checkInTime);
  });

  await t.test('6. Fichar SALIDA Web mediante POST /attendance/check-out', async () => {
    const res = await request('/attendance/check-out', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        latitude: 41.3885,
        longitude: 2.1705,
        accuracy: 12.0,
        deviceInfo: 'Chrome Android / Web Browser',
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.equal(res.data.record.type, 'CHECK_OUT');
  });

  await t.test('7. Estado Web tras Salida: JORNADA FINALIZADA y Cómputo de Horas', async () => {
    const res = await request('/attendance/my-status', {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.data.status, 'FINISHED');
    assert.equal(res.data.data.statusText, 'JORNADA FINALIZADA');
    assert.ok(res.data.data.hoursWorked);
  });

  await t.test('8. Consultar Historial Web del Trabajador mediante GET /attendance/history', async () => {
    const res = await request('/attendance/history', {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.data.length, 2);
    // Verificación de punto exacto puntual sin rutas
    assert.ok(res.data.data[0].latitude);
    assert.ok(res.data.data[0].longitude);
  });

  await t.test('9. Consultar Auditoría mediante GET /audit-logs (Admin Only)', async () => {
    // Admin puede consultar audit-logs
    const resAdmin = await request('/audit-logs', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resAdmin.status, 200);
    assert.ok(resAdmin.data.data.length >= 2);

    // Trabajador NO puede consultar audit-logs (403)
    const resWorker = await request('/audit-logs', {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(resWorker.status, 403);
  });

  await t.test('10. Cierre de servidor de test', async () => {
    await new Promise((resolve) => server.close(resolve));
    await dbPool.end();
  });
});
