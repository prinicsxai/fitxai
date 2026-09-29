const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const { app } = require('../backend/dist/app');
const { dbPool } = require('../backend/dist/db/pool');
const { realtimeService } = require('../backend/dist/services/realtime.service');

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

/**
 * Cliente SSE para pruebas que lee el stream HTTP y decodifica eventos
 */
function createSSEClient(token) {
  const controller = new AbortController();
  const events = [];
  let waitingResolvers = [];

  const streamUrl = `${baseUrl}/realtime/stream?token=${encodeURIComponent(token)}`;

  const connectPromise = fetch(streamUrl, {
    signal: controller.signal,
    headers: { Accept: 'text/event-stream' },
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SSE connection failed with status ${res.status}: ${text}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        if (!part.trim() || part.startsWith(':')) continue; // Skip comments/pings

        const lines = part.split('\n');
        let eventType = 'message';
        let eventData = '';
        let eventId = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData = line.substring(6).trim();
          } else if (line.startsWith('id: ')) {
            eventId = line.substring(4).trim();
          }
        }

        try {
          const parsed = JSON.parse(eventData);
          const ev = { event: eventType, data: parsed, id: eventId };

          // Despachar a quien esté esperando o encolar para consumo posterior
          if (waitingResolvers.length > 0) {
            const resolve = waitingResolvers.shift();
            resolve(ev);
          } else {
            events.push(ev);
          }
        } catch (_) {}
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      console.warn('[TEST_SSE] Error en lectura SSE:', err.message);
    }
  });

  return {
    async waitForNextEvent(timeoutMs = 4000) {
      if (events.length > 0) {
        return events.shift();
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const idx = waitingResolvers.indexOf(resolve);
          if (idx !== -1) waitingResolvers.splice(idx, 1);
          reject(new Error(`Timeout esperando evento SSE tras ${timeoutMs}ms`));
        }, timeoutMs);

        waitingResolvers.push((ev) => {
          clearTimeout(timer);
          resolve(ev);
        });
      });
    },
    getReceivedEvents() {
      return [...events];
    },
    close() {
      controller.abort();
    },
  };
}

test('SISTEMA DE ACTUALIZACIÓN EN TIEMPO REAL (PARTE 6)', async (t) => {
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
  let workerBToken;
  let sseClientA;
  let sseClientB;

  await t.test('1. Setup Empresas, Administradores y Trabajadores', async () => {
    const hash = await bcrypt.hash('Secret123!', 10);

    // Empresa A
    const compARes = await request('/companies', {
      method: 'POST',
      body: { name: `Alpha Corp ${timestamp}`, cif: `CIF-A-${timestamp}`, contactEmail: `a-${timestamp}@alpha.es` },
    });
    assert.equal(compARes.status, 201);
    companyAId = compARes.data.data.id;

    // Admin A
    await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Admin', 'Alpha', 'ADMIN', 'ACTIVE')`,
      [companyAId, `admin.a-${timestamp}@alpha.es`, hash]
    );

    // Trabajador A (Marc Puig)
    const workerAU = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Marc', 'Puig', 'EMPLOYEE', 'ACTIVE')
       RETURNING id`,
      [companyAId, `marc.puig-${timestamp}@alpha.es`, hash]
    );
    await dbPool.query(
      `INSERT INTO employees (user_id, company_id, first_name, last_name, document_id, employee_code, department, job_title)
       VALUES ($1, $2, 'Marc', 'Puig', 'DNI-MARC-PUIG', 'EMP-PUIG-01', 'Operaciones', 'Conductor')`,
      [workerAU.rows[0].id, companyAId]
    );

    // Empresa B (Para verificar aislamiento)
    const compBRes = await request('/companies', {
      method: 'POST',
      body: { name: `Beta Corp ${timestamp}`, cif: `CIF-B-${timestamp}`, contactEmail: `b-${timestamp}@beta.es` },
    });
    companyBId = compBRes.data.data.id;

    // Admin B
    await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Admin', 'Beta', 'ADMIN', 'ACTIVE')`,
      [companyBId, `admin.b-${timestamp}@beta.es`, hash]
    );

    // Trabajador B
    const workerBU = await dbPool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Joan', 'Soler', 'EMPLOYEE', 'ACTIVE')
       RETURNING id`,
      [companyBId, `joan.soler-${timestamp}@beta.es`, hash]
    );
    await dbPool.query(
      `INSERT INTO employees (user_id, company_id, first_name, last_name, document_id, employee_code)
       VALUES ($1, $2, 'Joan', 'Soler', 'DNI-JOAN-SOLER', 'EMP-SOLER-02')`,
      [workerBU.rows[0].id, companyBId]
    );

    // Iniciar Sesiones
    const lAdminA = await request('/auth/login', {
      method: 'POST',
      body: { email: `admin.a-${timestamp}@alpha.es`, password: 'Secret123!' },
    });
    adminAToken = lAdminA.data.token;

    const lAdminB = await request('/auth/login', {
      method: 'POST',
      body: { email: `admin.b-${timestamp}@beta.es`, password: 'Secret123!' },
    });
    adminBToken = lAdminB.data.token;

    const lWorkerA = await request('/auth/login', {
      method: 'POST',
      body: { email: `marc.puig-${timestamp}@alpha.es`, password: 'Secret123!' },
    });
    workerAToken = lWorkerA.data.token;

    const lWorkerB = await request('/auth/login', {
      method: 'POST',
      body: { email: `joan.soler-${timestamp}@beta.es`, password: 'Secret123!' },
    });
    workerBToken = lWorkerB.data.token;

    assert.ok(adminAToken && adminBToken && workerAToken && workerBToken);
  });

  await t.test('2. Control de Seguridad de Acceso al Canal en Tiempo Real', async () => {
    // 2.1 Petición sin token -> 401
    const noTokenRes = await fetch(`${baseUrl}/realtime/stream`);
    assert.equal(noTokenRes.status, 401);

    // 2.2 Un trabajador normal intenta abrir el stream de administración -> 403
    const workerStreamRes = await fetch(`${baseUrl}/realtime/stream?token=${workerAToken}`);
    assert.equal(workerStreamRes.status, 403);
  });

  await t.test('3. Conectar Administradores A y B al Canal SSE en Vivo', async () => {
    sseClientA = createSSEClient(adminAToken);
    sseClientB = createSSEClient(adminBToken);

    // Esperar evento inicial 'connected'
    const evA = await sseClientA.waitForNextEvent();
    assert.equal(evA.event, 'connected');
    assert.equal(evA.data.status, 'connected');
    assert.equal(evA.data.companyId, companyAId);

    const evB = await sseClientB.waitForNextEvent();
    assert.equal(evB.event, 'connected');
    assert.equal(evB.data.companyId, companyBId);

    // Verificar suscriptores registrados por empresa
    assert.equal(realtimeService.getSubscriberCount(companyAId), 1);
    assert.equal(realtimeService.getSubscriberCount(companyBId), 1);
  });

  await t.test('4. Fichar ENTRADA (Móvil) y Comprobar Emisión Inmediata y Aislamiento', async () => {
    // Marc Puig ficha ENTRADA
    const punchRes = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerAToken}` },
      body: {
        type: 'ENTRADA',
        latitude: 41.3879,
        longitude: 2.1699,
        accuracy: 10.5,
        deviceInfo: 'OnePlus 12 (Android 14)',
      },
    });
    assert.equal(punchRes.status, 201);
    assert.equal(punchRes.data.record.type, 'CHECK_IN');

    // Admin A debe recibir inmediatamente el evento NEW_PUNCH
    const liveEventA = await sseClientA.waitForNextEvent();
    assert.equal(liveEventA.event, 'NEW_PUNCH');
    assert.ok(liveEventA.id, 'Debe incluir un ID de evento único para deduplicación');

    // Comprobar formato exacto exigido por el usuario
    assert.equal(liveEventA.data.notification.title, 'Nou fitxatge');
    assert.equal(liveEventA.data.notification.workerName, 'Marc Puig');
    assert.equal(liveEventA.data.notification.punchType, 'Entrada');
    assert.ok(liveEventA.data.notification.time);
    assert.equal(liveEventA.data.notification.locationStatus, 'Ubicació registrada');

    assert.equal(liveEventA.data.record.type, 'CHECK_IN');
    assert.equal(liveEventA.data.record.tipo, 'ENTRADA');
    assert.equal(liveEventA.data.record.employee_id, punchRes.data.record.employeeId);

    // AISLAMIENTO: Admin B de la Empresa B NO debe haber recibido ningún evento de Empresa A
    const eventsB = sseClientB.getReceivedEvents();
    assert.equal(eventsB.length, 0, 'La Empresa B nunca debe recibir eventos de la Empresa A');
  });

  await t.test('5. Fichar SALIDA (Móvil) y Comprobar Emisión Inmediata de Salida', async () => {
    // Marc Puig ficha SALIDA
    const punchRes = await request('/attendance/punch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerAToken}` },
      body: {
        type: 'SALIDA',
        latitude: 41.3882,
        longitude: 2.1701,
        accuracy: 9.0,
      },
    });
    assert.equal(punchRes.status, 201);
    assert.equal(punchRes.data.record.type, 'CHECK_OUT');

    // Admin A recibe inmediatamente evento de SALIDA
    const liveEventA = await sseClientA.waitForNextEvent();
    assert.equal(liveEventA.event, 'NEW_PUNCH');
    assert.equal(liveEventA.data.notification.punchType, 'Salida');
    assert.equal(liveEventA.data.record.type, 'CHECK_OUT');
    assert.equal(liveEventA.data.record.tipo, 'SALIDA');
  });

  await t.test('6. Cortar Conexión (Desconexión de Admin A)', async () => {
    // Se corta la conexión SSE
    sseClientA.close();

    // Esperar ciclo de socket close
    await new Promise((r) => setTimeout(r, 80));

    // El servidor debe haber liberado el cliente
    assert.equal(realtimeService.getSubscriberCount(companyAId), 0);
  });

  await t.test('7. Reconectar y Comprobar Recuperación Exitosa', async () => {
    // Reconexión del cliente
    sseClientA = createSSEClient(adminAToken);

    const evReconnect = await sseClientA.waitForNextEvent();
    assert.equal(evReconnect.event, 'connected');
    assert.equal(evReconnect.data.status, 'connected');
    assert.equal(realtimeService.getSubscriberCount(companyAId), 1);

    // Consulta de sincronización tras reconexión
    const syncRes = await request('/admin/attendance?limit=10', {
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert.equal(syncRes.status, 200);
    assert.ok(syncRes.data.data.length >= 2, 'Los fichajes realizados están sincronizados');
  });

  t.after(() => {
    if (sseClientA) sseClientA.close();
    if (sseClientB) sseClientB.close();
    realtimeService.clearAll();
    if (server) server.close();
  });
});
