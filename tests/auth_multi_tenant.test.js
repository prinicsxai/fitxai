const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

// Importamos la app de backend compilada
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

test('SISTEMA COMPLETO DE AUTENTICACIÓN, EMPRESAS, TRABAJADORES Y AISLAMIENTO', async (t) => {
  // Iniciar servidor de prueba en puerto efímero
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
      resolve();
    });
  });

  const timestamp = Date.now();
  let companyA;
  let companyB;
  let adminAToken;
  let adminBToken;
  let workerAId;
  let workerAToken;
  let workerBId;
  let workerBToken;

  await t.test('1. Crear Empresa A y Empresa B (Multi-tenant)', async () => {
    const resA = await request('/companies', {
      method: 'POST',
      body: {
        name: `Acme Corp ${timestamp}`,
        cif: `CIF-A-${timestamp}`,
        contactEmail: `contactA-${timestamp}@acme.com`,
      },
    });
    assert.equal(resA.status, 201);
    assert.equal(resA.data.success, true);
    companyA = resA.data.data;

    const resB = await request('/companies', {
      method: 'POST',
      body: {
        name: `Beta Logistics ${timestamp}`,
        cif: `CIF-B-${timestamp}`,
        contactEmail: `contactB-${timestamp}@beta.com`,
      },
    });
    assert.equal(resB.status, 201);
    companyB = resB.data.data;
  });

  await t.test('2. Crear Administrador en Empresa A y en Empresa B', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('AdminSecurePass123!', 10);

    // Admin A
    const resAdminA = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, phone, role, status)
       VALUES ($1, $2, $3, 'Admin', 'EmpresaA', '+34 611 111 111', 'ADMIN', 'ACTIVE')
       RETURNING id, email`,
      [companyA.id, `adminA-${timestamp}@acme.com`, hash]
    );
    assert.ok(resAdminA.rows[0].id);

    // Admin B
    const resAdminB = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, phone, role, status)
       VALUES ($1, $2, $3, 'Admin', 'EmpresaB', '+34 622 222 222', 'ADMIN', 'ACTIVE')
       RETURNING id, email`,
      [companyB.id, `adminB-${timestamp}@beta.com`, hash]
    );
    assert.ok(resAdminB.rows[0].id);
  });

  await t.test('3. Iniciar sesión como Administrador A y B', async () => {
    const loginA = await request('/auth/login', {
      method: 'POST',
      body: {
        email: `adminA-${timestamp}@acme.com`,
        password: 'AdminSecurePass123!',
      },
    });
    assert.equal(loginA.status, 200);
    assert.ok(loginA.data.token);
    assert.equal(loginA.data.user.role, 'ADMIN');
    assert.equal(loginA.data.user.companyId, companyA.id);
    adminAToken = loginA.data.token;

    const loginB = await request('/auth/login', {
      method: 'POST',
      body: {
        email: `adminB-${timestamp}@beta.com`,
        password: 'AdminSecurePass123!',
      },
    });
    assert.equal(loginB.status, 200);
    adminBToken = loginB.data.token;
  });

  await t.test('4. Crear Trabajador en Empresa A y Trabajador en Empresa B', async () => {
    // Admin A crea Worker A
    const resWorkerA = await request('/employees', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: `juan.perez-${timestamp}@acme.com`,
        password: 'WorkerSecurePass123!',
        phone: '+34 633 333 333',
        documentId: `DNI-A-${timestamp}`,
        employeeCode: 'EMP-A-01',
        department: 'Almacén',
        jobTitle: 'Operario Especialista',
        schedule: 'L-V 07:00 - 15:00',
      },
    });
    assert.equal(resWorkerA.status, 201);
    assert.equal(resWorkerA.data.success, true);
    assert.equal(resWorkerA.data.data.companyId, companyA.id);
    workerAId = resWorkerA.data.data.id;

    // Admin B crea Worker B
    const resWorkerB = await request('/employees', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminBToken}` },
      body: {
        firstName: 'Laura',
        lastName: 'Gómez',
        email: `laura.gomez-${timestamp}@beta.com`,
        password: 'WorkerSecurePass123!',
        phone: '+34 644 444 444',
        documentId: `DNI-B-${timestamp}`,
        employeeCode: 'EMP-B-01',
        department: 'Transporte',
        jobTitle: 'Conductora',
        schedule: 'L-V 08:00 - 16:30',
      },
    });
    assert.equal(resWorkerB.status, 201);
    workerBId = resWorkerB.data.data.id;
  });

  await t.test('5. Iniciar sesión como Trabajador A y como Trabajador B', async () => {
    const loginWA = await request('/auth/login', {
      method: 'POST',
      body: {
        email: `juan.perez-${timestamp}@acme.com`,
        password: 'WorkerSecurePass123!',
      },
    });
    assert.equal(loginWA.status, 200);
    assert.equal(loginWA.data.user.role, 'EMPLOYEE');
    assert.equal(loginWA.data.user.companyId, companyA.id);
    assert.equal(loginWA.data.user.employeeProfile.employeeCode, 'EMP-A-01');
    assert.equal(loginWA.data.user.employeeProfile.schedule, 'L-V 07:00 - 15:00');
    workerAToken = loginWA.data.token;

    const loginWB = await request('/auth/login', {
      method: 'POST',
      body: {
        email: `laura.gomez-${timestamp}@beta.com`,
        password: 'WorkerSecurePass123!',
      },
    });
    assert.equal(loginWB.status, 200);
    workerBToken = loginWB.data.token;
  });

  await t.test('6. Comprobar permisos del Trabajador (acceso a su propia cuenta)', async () => {
    const meRes = await request('/users/me', {
      headers: { Authorization: `Bearer ${workerAToken}` },
    });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.data.email, `juan.perez-${timestamp}@acme.com`);
    assert.equal(meRes.data.data.employeeProfile.id, workerAId);
  });

  await t.test('7 y 8. Trabajador intenta acceder a la lista o datos de otro trabajador -> BLOQUEADO (403)', async () => {
    // Intento 1: Trabajador intenta listar empleados de la empresa
    const listRes = await request('/employees', {
      headers: { Authorization: `Bearer ${workerAToken}` },
    });
    assert.equal(listRes.status, 403, 'Trabajador no debe poder listar empleados');

    // Intento 2: Trabajador A intenta acceder a la ficha de Trabajador B
    const otherWorkerRes = await request(`/employees/${workerBId}`, {
      headers: { Authorization: `Bearer ${workerAToken}` },
    });
    assert.equal(otherWorkerRes.status, 403, 'Trabajador no debe poder ver datos de otro trabajador');
  });

  await t.test('9. Comprobar aislamiento absoluto entre empresas', async () => {
    // Admin A intenta ver a Trabajador B (de Empresa B)
    const adminAtoWorkerB = await request(`/employees/${workerBId}`, {
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert.equal(adminAtoWorkerB.status, 404, 'Admin A no debe poder ver empleados de Empresa B');

    // Admin A intenta listar empleados -> sólo debe recibir a Worker A, nunca a Worker B
    const listCompanyA = await request('/employees', {
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert.equal(listCompanyA.status, 200);
    const empIds = listCompanyA.data.data.map((e) => e.id);
    assert.ok(empIds.includes(workerAId), 'Empresa A debe contener a Worker A');
    assert.ok(!empIds.includes(workerBId), 'Empresa A NUNCA debe contener a Worker B');

    // Admin A intenta editar a Trabajador B de Empresa B -> BLOQUEADO
    const editRes = await request(`/employees/${workerBId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: { department: 'Ataque multi-tenant' },
    });
    assert.equal(editRes.status, 404, 'Admin A no debe poder modificar empleados de Empresa B');
  });

  await t.test('10. Comprobar Logout y Revocación de Sesión', async () => {
    // Logout de Worker A
    const logoutRes = await request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerAToken}` },
    });
    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.data.success, true);

    // Intentar volver a usar el token tras el logout -> debe rechazar con 401
    const meAfterLogout = await request('/users/me', {
      headers: { Authorization: `Bearer ${workerAToken}` },
    });
    assert.equal(meAfterLogout.status, 401, 'Token revocado debe ser rechazado');
  });

  await t.test('11. Comprobar Recuperación de Contraseña (Forgot & Reset)', async () => {
    // 1. Solicitar reseteo
    const forgotRes = await request('/auth/forgot-password', {
      method: 'POST',
      body: { email: `adminB-${timestamp}@beta.com` },
    });
    assert.equal(forgotRes.status, 200);
    const resetToken = forgotRes.data.resetToken;
    assert.ok(resetToken, 'Debe devolver resetToken en desarrollo');

    // 2. Ejecutar reseteo con nueva contraseña
    const resetRes = await request('/auth/reset-password', {
      method: 'POST',
      body: {
        token: resetToken,
        newPassword: 'BrandNewPassword2026!',
      },
    });
    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.data.success, true);

    // 3. Login con la nueva contraseña debe funcionar
    const loginNew = await request('/auth/login', {
      method: 'POST',
      body: {
        email: `adminB-${timestamp}@beta.com`,
        password: 'BrandNewPassword2026!',
      },
    });
    assert.equal(loginNew.status, 200);
    assert.ok(loginNew.data.token);
  });

  // Limpieza al finalizar
  await new Promise((resolve) => server.close(resolve));
  await dbPool.end();
});
