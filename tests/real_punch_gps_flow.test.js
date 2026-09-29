const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

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

test('SISTEMA REAL DE FICHAJE Y GPS PUNTUAL (PARTE 5)', async (t) => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
      resolve();
    });
  });

  const timestamp = Date.now();
  let companyAId;
  let companyBId;
  let adminAToken;
  let adminBToken;
  let workerAToken;
  let workerAEmployeeId;
  let workerBToken;
  let workerBEmployeeId;
  let createdPunchId;

  await t.test('1. Setup Multi-Empresa, Administradores y Trabajadores', async () => {
    const hash = await bcrypt.hash('SecurePass123!', 10);

    // Empresa A
    const compARes = await request('/companies', {
      method: 'POST',
      body: {
        name: `Logística Alpha ${timestamp}`,
        cif: `CIF-A-${timestamp}`,
        contactEmail: `admin-a-${timestamp}@alpha.es`,
      },
    });
    assert.equal(compARes.status, 201);
    companyAId = compARes.data.data.id;

    // Admin A
    const adminAU = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Admin', 'Alpha', 'ADMIN', 'ACTIVE')
       RETURNING id`,
      [companyAId, `admin.a-${timestamp}@alpha.es`, hash]
    );

    // Trabajador A
    const workerAU = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Roberto', 'Navarro', 'EMPLOYEE', 'ACTIVE')
       RETURNING id`,
      [companyAId, `roberto.worker-${timestamp}@alpha.es`, hash]
    );
    const empARes = await dbPool.query(
      `INSERT INTO employees (user_id, company_id, first_name, last_name, document_id, employee_code, department, job_title)
       VALUES ($1, $2, 'Roberto', 'Navarro', 'DNI-ROBERTO-01', 'EMP-ROB-01', 'Logística', 'Repartidor')
       RETURNING id`,
      [workerAU.rows[0].id, companyAId]
    );
    workerAEmployeeId = empARes.rows[0].id;

    // Empresa B (Para verificar aislamiento multi-tenant)
    const compBRes = await request('/companies', {
      method: 'POST',
      body: {
        name: `Servicios Beta ${timestamp}`,
        cif: `CIF-B-${timestamp}`,
        contactEmail: `admin-b-${timestamp}@beta.es`,
      },
    });
    assert.equal(compBRes.status, 201);
    companyBId = compBRes.data.data.id;

    // Admin B
    await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Admin', 'Beta', 'ADMIN', 'ACTIVE')
       RETURNING id`,
      [companyBId, `admin.b-${timestamp}@beta.es`, hash]
    );

    // Trabajador B
    const workerBU = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Laura', 'Gómez', 'EMPLOYEE', 'ACTIVE')
       RETURNING id`,
      [companyBId, `laura.worker-${timestamp}@beta.es`, hash]
    );
    const empBRes = await dbPool.query(
      `INSERT INTO employees (user_id, company_id, first_name, last_name, document_id, employee_code)
       VALUES ($1, $2, 'Laura', 'Gómez', 'DNI-LAURA-02', 'EMP-LAU-02')
       RETURNING id`,
      [workerBU.rows[0].id, companyBId]
    );
    workerBEmployeeId = empBRes.rows[0].id;

    // Iniciar sesiones
    const loginAdminA = await request('/auth/login', {
      method: 'POST',
      body: { email: `admin.a-${timestamp}@alpha.es`, password: 'SecurePass123!' },
    });
    adminAToken = loginAdminA.data.token;

    const loginAdminB = await request('/auth/login', {
      method: 'POST',
      body: { email: `admin.b-${timestamp}@beta.es`, password: 'SecurePass123!' },
    });
    adminBToken = loginAdminB.data.token;

    const loginWorkerA = await request('/auth/login', {
      method: 'POST',
      body: { email: `roberto.worker-${timestamp}@alpha.es`, password: 'SecurePass123!' },
    });
    workerAToken = loginWorkerA.data.token;

    const loginWorkerB = await request('/auth/login', {
      method: 'POST',
      body: { email: `laura.worker-${timestamp}@beta.es`, password: 'SecurePass123!' },
    });
    workerBToken = loginWorkerB.data.token;

    assert.ok(adminAToken && adminBToken && workerAToken && workerBToken);
  });

  await t.test('2. Fichar ENTRADA y Verificar Autoridad Absoluta del Servidor en Fecha y Hora', async () => {
    const beforeTime = new Date().getTime();

    const punchRes = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerAToken}` },
      body: {
        type: 'ENTRADA', // Admite 'ENTRADA' en español
        latitude: 40.416775,
        longitude: -3.703790,
        accuracy: 12.4, // ±12.4 metros
        deviceInfo: 'Google Pixel 8 (Android 14)',
      },
    });

    const afterTime = new Date().getTime();

    assert.equal(punchRes.status, 201);
    assert.equal(punchRes.data.success, true);
    assert.equal(punchRes.data.record.type, 'CHECK_IN');
    assert.equal(punchRes.data.record.tipo, 'ENTRADA');
    assert.ok(punchRes.data.record.fecha, 'Debe devolver la fecha oficial');
    assert.ok(punchRes.data.record.hora, 'Debe devolver la hora oficial');
    assert.ok(punchRes.data.record.timestamp, 'Debe devolver el timestamp oficial');
    assert.equal(punchRes.data.record.status, 'VERIFIED');

    // Comprobar que el timestamp del servidor está sincronizado con la ventana de ejecución
    const serverTimestampMs = new Date(punchRes.data.record.timestamp).getTime();
    assert.ok(serverTimestampMs >= beforeTime - 2000 && serverTimestampMs <= afterTime + 2000);

    // Comprobar que se guardó en attendance_records y en location_records (1:1)
    createdPunchId = punchRes.data.record.id;
    const dbLoc = await dbPool.query(
      `SELECT * FROM location_records WHERE attendance_record_id = $1`,
      [createdPunchId]
    );
    assert.equal(dbLoc.rows.length, 1);
    assert.equal(dbLoc.rows[0].latitude, 40.416775);
    assert.equal(dbLoc.rows[0].longitude, -3.703790);
    assert.equal(dbLoc.rows[0].accuracy, 12.4);
  });

  await t.test('3. Prevención de Fichajes Duplicados (Doble pulsación accidental)', async () => {
    // El trabajador accidentalmente vuelve a pulsar "FICHAR ENTRADA" < 30 segundos
    const dupRes = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerAToken}` },
      body: {
        type: 'CHECK_IN',
        latitude: 40.416775,
        longitude: -3.703790,
        accuracy: 12.4,
      },
    });

    assert.equal(dupRes.status, 409);
    assert.equal(dupRes.data.success, false);
    assert.equal(dupRes.data.code, 'DUPLICATE_PUNCH');
    assert.equal(dupRes.data.duplicate, true);
  });

  await t.test('4. Fichar SALIDA con éxito y Verificar Orden Lógico', async () => {
    // Registrar salida legítima
    const checkOutRes = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerAToken}` },
      body: {
        type: 'SALIDA',
        latitude: 40.417200,
        longitude: -3.704100,
        accuracy: 9.8,
      },
    });
    assert.equal(checkOutRes.status, 201);
    assert.equal(checkOutRes.data.record.type, 'CHECK_OUT');
    assert.equal(checkOutRes.data.record.tipo, 'SALIDA');

    // Intentar una segunda SALIDA consecutiva -> RECHAZADA (No se puede fichar salida sin haber entrado)
    const secondCheckOut = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerAToken}` },
      body: {
        type: 'SALIDA',
        latitude: 40.417200,
        longitude: -3.704100,
        accuracy: 9.8,
      },
    });
    assert.equal(secondCheckOut.status, 409);
    assert.equal(secondCheckOut.data.success, false);
  });

  await t.test('5. Validación de Coordenadas Fuera de Rango y Coordenadas Nulas (0,0)', async () => {
    // Latitud fuera de rango (> 90)
    const badLat = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerAToken}` },
      body: {
        type: 'CHECK_IN',
        latitude: 95.5,
        longitude: -3.70,
        accuracy: 10,
      },
    });
    assert.equal(badLat.status, 400);

    // Coordenadas nulas / inválidas (0, 0)
    const nullCoords = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerAToken}` },
      body: {
        type: 'CHECK_IN',
        latitude: 0,
        longitude: 0,
        accuracy: 10,
      },
    });
    assert.equal(nullCoords.status, 400);
    assert.equal(nullCoords.data.code, 'INVALID_COORDINATES');
  });

  await t.test('6. Detección y Rechazo de Ubicación Simulada (Fake / Mock GPS)', async () => {
    const mockRes = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerAToken}` },
      body: {
        type: 'CHECK_IN',
        latitude: 40.4168,
        longitude: -3.7038,
        accuracy: 5.0,
        isMocked: true, // Simulación detectada
      },
    });
    assert.equal(mockRes.status, 422);
    assert.equal(mockRes.data.code, 'MOCK_LOCATION_DETECTED');
  });

  await t.test('7. Validación de Precisión GPS Inaceptable (> 250m -> Rechazo con Reintento)', async () => {
    const lowAccuracyRes = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerAToken}` },
      body: {
        type: 'CHECK_IN',
        latitude: 40.4168,
        longitude: -3.7038,
        accuracy: 450.0, // Muy mala precisión (solo antenas celulares)
      },
    });
    assert.equal(lowAccuracyRes.status, 422);
    assert.equal(lowAccuracyRes.data.code, 'GPS_ACCURACY_TOO_LOW');
    assert.equal(lowAccuracyRes.data.canRetry, true);
  });

  await t.test('8. Inspección Detallada de Fichaje (GET /attendance/:id) con Punto Exacto sin Rutas', async () => {
    const detailRes = await request(`/attendance/${createdPunchId}`, {
      headers: { Authorization: `Bearer ${adminAToken}` },
    });

    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.data.success, true);
    const d = detailRes.data.data;

    assert.equal(d.id, createdPunchId);
    assert.equal(d.trabajador.nombre, 'Roberto Navarro');
    assert.equal(d.trabajador.documento, 'DNI-ROBERTO-01');
    assert.equal(d.tipo, 'CHECK_IN');
    assert.equal(d.tipo_label, 'ENTRADA');
    assert.ok(d.fecha);
    assert.ok(d.hora);
    assert.equal(d.latitud, 40.416775);
    assert.equal(d.longitud, -3.70379);
    assert.equal(d.precision, 12.4);
    assert.ok(d.ip_origen);
    assert.ok(d.dispositivo);

    // Comprobación de que el mapa es estrictamente un PUNTO PUNTUAL AISLADO SIN RUTAS
    assert.ok(d.map_point);
    assert.equal(d.map_point.is_single_point, true);
    assert.equal(d.map_point.tracks_allowed, false);
    assert.ok(d.map_point.osm_url.includes('40.416775'));
    assert.ok(d.map_point.osm_embed_url.includes('marker=40.416775%2C-3.70379'));
  });

  await t.test('9. Aislamiento Multi-Tenant Absoluto en la Consulta de Fichajes', async () => {
    // Admin B de la Empresa B intenta inspeccionar el fichaje de la Empresa A -> 404 (No existe para su empresa)
    const crossCompanyRes = await request(`/attendance/${createdPunchId}`, {
      headers: { Authorization: `Bearer ${adminBToken}` },
    });
    assert.equal(crossCompanyRes.status, 404);

    // Trabajador B intenta inspeccionar el fichaje del Trabajador A -> 404 / 403
    const crossWorkerRes = await request(`/attendance/${createdPunchId}`, {
      headers: { Authorization: `Bearer ${workerBToken}` },
    });
    assert.equal(crossWorkerRes.status, 404);
  });

  await t.test('10. Filtros de Fichajes del Administrador (Por Tipo, Trabajador y Fecha)', async () => {
    const listRes = await request(`/admin/attendance?employeeId=${workerAEmployeeId}&type=ENTRADA`, {
      headers: { Authorization: `Bearer ${adminAToken}` },
    });

    assert.equal(listRes.status, 200);
    assert.ok(listRes.data.data.length >= 1);
    assert.equal(listRes.data.data[0].type, 'CHECK_IN');
    assert.equal(listRes.data.data[0].employee_id, workerAEmployeeId);
    assert.ok(listRes.data.data[0].fecha);
    assert.ok(listRes.data.data[0].hora);
  });

  t.after(() => {
    if (server) server.close();
  });
});
