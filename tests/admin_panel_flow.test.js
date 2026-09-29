const test = require('node:test');
const assert = require('node:assert/strict');

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

test('FLUJO COMPLETO DEL PANEL WEB DE ADMINISTRACIÓN (PARTE 3)', async (t) => {
  // Iniciar servidor en puerto efímero
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
      resolve();
    });
  });

  const timestamp = Date.now();
  let company;
  let adminToken;
  let employeeId;
  let employeeUserId;
  let workerToken;

  await t.test('1. Crear Empresa y Administrador e Iniciar Sesión', async () => {
    const compRes = await request('/companies', {
      method: 'POST',
      body: {
        name: `Corporación Global ${timestamp}`,
        cif: `CIF-PANEL-${timestamp}`,
        contactEmail: `admin-panel-${timestamp}@global.es`,
      },
    });
    assert.equal(compRes.status, 201);
    company = compRes.data.data;

    // Crear Admin en DB con Bcrypt
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('AdminPanelPass123!', 10);
    await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, phone, role, status)
       VALUES ($1, $2, $3, 'Admin', 'Empresarial', '+34 600 999 888', 'ADMIN', 'ACTIVE')`,
      [company.id, `admin-panel-${timestamp}@global.es`, hash]
    );

    // Iniciar Sesión
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: {
        email: `admin-panel-${timestamp}@global.es`,
        password: 'AdminPanelPass123!',
      },
    });
    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.data.token);
    adminToken = loginRes.data.token;
  });

  await t.test('2. Comprobar Métricas del Dashboard (7 métricas)', async () => {
    const statsRes = await request('/admin/stats', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(statsRes.status, 200);
    const d = statsRes.data.data;
    assert.equal(typeof d.totalEmployees, 'number');
    assert.equal(typeof d.activeEmployees, 'number');
    assert.equal(typeof d.todayPunches, 'number');
    assert.equal(typeof d.todayCheckIns, 'number');
    assert.equal(typeof d.todayCheckOuts, 'number');
    assert.equal(typeof d.todayHoursWorked, 'number');
    assert.equal(typeof d.pendingIncidents, 'number');
  });

  await t.test('3. Crear Trabajador desde el Panel', async () => {
    const empRes = await request('/employees', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'Elena',
        lastName: 'Ríos Sanz',
        email: `elena.rios-${timestamp}@global.es`,
        password: 'WorkerElenaPass123!',
        phone: '+34 677 888 999',
        documentId: `DNI-${timestamp}`,
        employeeCode: 'EMP-PANEL-01',
        department: 'Ingeniería',
        jobTitle: 'Desarrolladora Senior',
        schedule: 'Lunes a Viernes 08:30 - 17:00',
      },
    });
    assert.equal(empRes.status, 201);
    assert.equal(empRes.data.success, true);
    employeeId = empRes.data.data.id;
    employeeUserId = empRes.data.data.userId;
    assert.ok(employeeId);
  });

  await t.test('4. Editar Trabajador', async () => {
    const editRes = await request(`/employees/${employeeId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        jobTitle: 'Lead Software Architect',
        department: 'I+D+i',
        phone: '+34 677 000 111',
      },
    });
    assert.equal(editRes.status, 200);
    assert.equal(editRes.data.success, true);
    assert.equal(editRes.data.data.job_title, 'Lead Software Architect');
    assert.equal(editRes.data.data.department, 'I+D+i');
  });

  await t.test('5. Ficha del Trabajador (Consultar perfil e historial)', async () => {
    const profileRes = await request(`/employees/${employeeId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(profileRes.status, 200);
    assert.equal(profileRes.data.data.job_title, 'Lead Software Architect');

    const historyRes = await request(`/employees/${employeeId}/attendance`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(historyRes.status, 200);
    assert.ok(Array.isArray(historyRes.data.data));
  });

  await t.test('6. Realizar Fichaje (Entrada y Salida) y Consultar Fichajes con Filtros', async () => {
    // Login de la trabajadora
    const workerLogin = await request('/auth/login', {
      method: 'POST',
      body: {
        email: `elena.rios-${timestamp}@global.es`,
        password: 'WorkerElenaPass123!',
      },
    });
    assert.equal(workerLogin.status, 200);
    workerToken = workerLogin.data.token;

    // Fichaje puntual ENTRADA
    const punchIn = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        type: 'CHECK_IN',
        latitude: 40.416775,
        longitude: -3.703790,
        accuracy: 6.2,
        notes: 'Entrada jornada ordinaria',
      },
    });
    assert.equal(punchIn.status, 201);
    assert.equal(punchIn.data.record.location.accuracy, 6.2);

    // Fichaje puntual SALIDA
    const punchOut = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        type: 'CHECK_OUT',
        latitude: 40.416800,
        longitude: -3.703810,
        accuracy: 5.8,
        notes: 'Salida fin de jornada',
      },
    });
    assert.equal(punchOut.status, 201);

    // Consulta con Filtros desde el Panel del Administrador
    // 1. Filtro por tipo = CHECK_IN
    const filterIn = await request('/admin/attendance?type=CHECK_IN', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(filterIn.status, 200);
    assert.ok(filterIn.data.data.every((r) => r.type === 'CHECK_IN'));

    // 2. Filtro por empleado
    const filterEmp = await request(`/admin/attendance?employeeId=${employeeId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(filterEmp.status, 200);
    assert.equal(filterEmp.data.data.length, 2);

    // 3. Comprobar que contiene la ubicación GPS puntual exacta
    const punch = filterEmp.data.data[0];
    assert.ok(punch.latitude);
    assert.ok(punch.longitude);
    assert.ok(punch.accuracy);
  });

  await t.test('7. Desactivar y Reactivar Trabajador', async () => {
    // Desactivar
    const deleteRes = await request(`/employees/${employeeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(deleteRes.status, 200);

    // Comprobar que el trabajador ya no puede iniciar sesión
    const tryLogin = await request('/auth/login', {
      method: 'POST',
      body: {
        email: `elena.rios-${timestamp}@global.es`,
        password: 'WorkerElenaPass123!',
      },
    });
    assert.equal(tryLogin.status, 403, 'Trabajador desactivado no debe poder iniciar sesión');

    // Reactivar
    const reactivateRes = await request(`/employees/${employeeId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { isActive: true },
    });
    assert.equal(reactivateRes.status, 200);
    assert.equal(reactivateRes.data.data.is_active, true);

    // Comprobar que tras reactivar, el login vuelve a funcionar
    const loginAgain = await request('/auth/login', {
      method: 'POST',
      body: {
        email: `elena.rios-${timestamp}@global.es`,
        password: 'WorkerElenaPass123!',
      },
    });
    assert.equal(loginAgain.status, 200);
  });

  // Limpieza
  await new Promise((resolve) => server.close(resolve));
  await dbPool.end();
});
