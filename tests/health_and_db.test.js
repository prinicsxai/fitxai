const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://dpeixotoc@localhost:5432/fitxai_dev?schema=public';

test('1. Database Connection and Schema Integrity', async (t) => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  await t.test('PostgreSQL connection is alive and running', async () => {
    const res = await client.query('SELECT 1 as alive');
    assert.equal(res.rows[0].alive, 1);
  });

  await t.test('All 11 requested business entities exist', async () => {
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    const res = await client.query(tablesQuery);
    const tableNames = res.rows.map(r => r.table_name);

    const requiredTables = [
      'users',
      'employees',
      'companies',
      'attendance_records',
      'location_records',
      'devices',
      'sessions',
      'incidents',
      'audit_logs',
      'notifications',
      'settings'
    ];

    for (const table of requiredTables) {
      assert.ok(tableNames.includes(table), `Table ${table} must exist in database`);
    }
  });

  await t.test('Location record is strictly 1:1 foreign keyed to attendance record', async () => {
    const fkQuery = `
      SELECT
        tc.table_name, kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'location_records';
    `;
    const res = await client.query(fkQuery);
    assert.ok(res.rows.some(r => r.column_name === 'attendance_record_id' && r.foreign_table_name === 'attendance_records'));
  });

  await client.end();
});
