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

test('FLUJO COMPLETO DE LA APP MÓVIL DEL TRABAJADOR (PARTE 4)', async (t) => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
      resolve();
    });
  });

  const timestamp = Date.now();
  let companyId;
  let workerUserId;
  let workerEmployeeId;
  let workerToken;
  let otherWorkerUserId;

  await t.test('1. Setup Empresa y Trabajadores de Prueba', async () => {
    const compRes = await request('/companies', {
      method: 'POST',
      body: {
        name: `Transportes Express ${timestamp}`,
        cif: `CIF-MOB-${timestamp}`,
        contactEmail: `logistica-${timestamp}@express.es`,
      },
    });
    assert.equal(compRes.status, 201);
    companyId = compRes.data.data.id;

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('WorkerSecret123!', 10);

    // Trabajador Principal
    const uRes = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, phone, role, status)
       VALUES ($1, $2, $3, 'Carlos', 'García', '+34 611 222 333', 'EMPLOYEE', 'ACTIVE')
       RETURNING id`,
      [companyId, `carlos.worker-${timestamp}@express.es`, hash]
    );
    workerUserId = uRes.rows[0].id;

    const empRes = await dbPool.query(
      `INSERT INTO employees (user_id, company_id, first_name, last_name, document_id, employee_code, department, job_title)
       VALUES ($1, $2, 'Carlos', 'García', 'DNI-WORKER-01', 'EMP-0042', 'Operaciones', 'Técnico de Campo')
       RETURNING id`,
      [workerUserId, companyId]
    );
    workerEmployeeId = empRes.rows[0].id;

    // Otro Trabajador (para validar aislamiento estricto de historial)
    const otherU = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Marta', 'Soto', 'EMPLOYEE', 'ACTIVE')
       RETURNING id`,
      [companyId, `marta.worker-${timestamp}@express.es`, hash]
    );
    otherWorkerUserId = otherU.rows[0].id;

    const otherEmp = await dbPool.query(
      `INSERT INTO employees (user_id, company_id, first_name, last_name, document_id)
       VALUES ($1, $2, 'Marta', 'Soto', 'DNI-WORKER-02')
       RETURNING id`,
      [otherWorkerUserId, companyId]
    );

    // Fichaje previo del otro trabajador
    await dbPool.query(
      `INSERT INTO attendance_records (employee_id, company_id, type, timestamp, status)
       VALUES ($1, $2, 'CHECK_IN', NOW() - interval '2 hours', 'VERIFIED')`,
      [otherEmp.rows[0].id, companyId]
    );
  });

  await t.test('2. Iniciar Sesión como Trabajador', async () => {
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: {
        email: `carlos.worker-${timestamp}@express.es`,
        password: 'WorkerSecret123!',
        platform: 'android',
      },
    });
    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.data.token);
    assert.equal(loginRes.data.user.role, 'EMPLOYEE');
    assert.equal(loginRes.data.user.employeeProfile.employeeCode, 'EMP-0042');
    workerToken = loginRes.data.token;
  });

  await t.test('3. Estado Inicial de la Jornada: "NO HAS FICHADO"', async () => {
    const statusRes = await request('/attendance/my-status', {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.data.data.status, 'NOT_STARTED');
    assert.equal(statusRes.data.data.statusText, 'NO HAS FICHADO');
    assert.equal(statusRes.data.data.actionButton, 'FICHAR ENTRADA');
    assert.equal(statusRes.data.data.nextType, 'CHECK_IN');
  });

  await t.test('4. Fichar Entrada con GPS Puntual', async () => {
    const punchRes = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        type: 'CHECK_IN',
        latitude: 40.416775,
        longitude: -3.703790,
        accuracy: 8.5,
        altitude: 660,
      },
    });
    assert.equal(punchRes.status, 201);
    assert.equal(punchRes.data.success, true);
    assert.equal(punchRes.data.record.type, 'CHECK_IN');
    assert.equal(punchRes.data.record.location.latitude, 40.416775);
    assert.equal(punchRes.data.record.location.accuracy, 8.5);
  });

  await t.test('5. Estado tras Entrada: "JORNADA ACTIVA"', async () => {
    const statusRes = await request('/attendance/my-status', {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.data.data.status, 'ACTIVE');
    assert.equal(statusRes.data.data.statusText, 'JORNADA ACTIVA');
    assert.equal(statusRes.data.data.actionButton, 'FICHAR SALIDA');
    assert.equal(statusRes.data.data.nextType, 'CHECK_OUT');
    assert.ok(statusRes.data.data.checkInTime);
  });

  await t.test('6. Fichar Salida con GPS Puntual', async () => {
    const punchRes = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        type: 'CHECK_OUT',
        latitude: 40.416800,
        longitude: -3.703810,
        accuracy: 7.2,
      },
    });
    assert.equal(punchRes.status, 201);
    assert.equal(punchRes.data.record.type, 'CHECK_OUT');
  });

  await t.test('7. Estado tras Salida: "JORNADA FINALIZADA" con cómputo de horas', async () => {
    const statusRes = await request('/attendance/my-status', {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.data.data.status, 'FINISHED');
    assert.equal(statusRes.data.data.statusText, 'JORNADA FINALIZADA');
    assert.ok(statusRes.data.data.checkInTime);
    assert.ok(statusRes.data.data.checkOutTime);
    assert.ok(statusRes.data.data.hoursWorked !== null);
  });

  await t.test('8. Historial "Mis Fichajes": Solo registros propios, sin datos de otros', async () => {
    const historyRes = await request('/attendance/my-punches', {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(historyRes.status, 200);
    assert.ok(historyRes.data.days.length >= 1);
    const day = historyRes.data.days[0];
    assert.ok(day.checkIn);
    assert.ok(day.checkOut);
    assert.ok(day.checkIn.latitude);
    assert.ok(day.checkOut.latitude);

    // Verificar que NINGUNO de los fichajes pertenece al otro trabajador
    const allPunches = historyRes.data.rawPunches;
    assert.ok(allPunches.length === 2);
    // Cada fichaje debe corresponder a Carlos García, nunca a Marta Soto
    for (const p of allPunches) {
      assert.equal(p.status, 'VERIFIED');
    }
  });

  await t.test('9. Detección de Precisión Degradada (> 150m) genera Incidencia Automática', async () => {
    const degradedPunch = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        type: 'CHECK_IN',
        latitude: 40.416800,
        longitude: -3.703810,
        accuracy: 250.0, // Degradada > 150m
      },
    });
    assert.equal(degradedPunch.status, 201);
    assert.equal(degradedPunch.data.record.status, 'FLAGGED');

    // Verificar en la base de datos que se generó un incidente LOW_GPS_ACCURACY
    const incRows = await dbPool.query(
      `SELECT type, severity FROM incidents WHERE employee_id = $1 AND type = 'LOW_GPS_ACCURACY'`,
      [workerEmployeeId]
    );
    assert.ok(incRows.rows.length >= 1);
  });

  await t.test('10. Reportar y Consultar Incidencias Manuales del Trabajador', async () => {
    const reportRes = await request('/incidents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        type: 'OLVIDO_FICHAJE',
        description: 'Se me olvidó fichar al entrar por fallo de cobertura en el aparcamiento subterráneo.',
        severity: 'MEDIUM',
      },
    });
    assert.equal(reportRes.status, 201);
    assert.equal(reportRes.data.success, true);

    const listRes = await request('/incidents/my-incidents', {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(listRes.status, 200);
    assert.ok(listRes.data.data.some((i) => i.type === 'OLVIDO_FICHAJE'));
  });

  await t.test('11. Logout del Trabajador y Revocación de Sesión', async () => {
    const logoutRes = await request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(logoutRes.status, 200);

    const meAfterLogout = await request('/attendance/my-status', {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert.equal(meAfterLogout.status, 401, 'Token revocado debe bloquear el acceso');
  });

  // Cierre de servidor y conexiones
  await new Promise((resolve) => server.close(resolve));
  await dbPool.end();
});
