import readline from 'readline';
import bcrypt from 'bcryptjs';
import { query, dbPool } from '../db/pool';
import { UserRole, UserStatus } from '@fitxai/shared';

function askQuestion(queryText: string, hideInput = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(queryText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runSetupAdmin() {
  console.log('\n======================================================');
  console.log('       FITXAI - Asistente de Configuración Inicial     ');
  console.log('======================================================\n');

  try {
    // 1. Obtener datos por variables de entorno o prompt interactivo
    const companyName = process.env.INIT_COMPANY_NAME || await askQuestion('Nombre de la Empresa: ');
    const companyCif = process.env.INIT_COMPANY_CIF || await askQuestion('CIF / Identificador Fiscal de la Empresa: ');
    const adminEmail = process.env.INIT_ADMIN_EMAIL || await askQuestion('Email del Administrador: ');
    const adminFirstName = process.env.INIT_ADMIN_FIRST_NAME || await askQuestion('Nombre del Administrador: ');
    const adminLastName = process.env.INIT_ADMIN_LAST_NAME || await askQuestion('Apellidos del Administrador: ');
    const adminPhone = process.env.INIT_ADMIN_PHONE || (process.env.INIT_ADMIN_EMAIL ? '' : await askQuestion('Teléfono del Administrador: '));
    const adminPassword = process.env.INIT_ADMIN_PASSWORD || await askQuestion('Contraseña de Acceso (mínimo 8 caracteres): ');

    if (!companyName || !companyCif || !adminEmail || !adminPassword) {
      console.error('\n❌ ERROR: Todos los campos marcados son obligatorios.');
      process.exit(1);
    }

    if (adminPassword.length < 8) {
      console.error('\n❌ ERROR: La contraseña debe tener al menos 8 caracteres de longitud.');
      process.exit(1);
    }

    console.log('\n[1/3] Verificando o creando empresa...');
    let companyId: string;
    const existingCompany = await query<any>(
      `SELECT id FROM companies WHERE LOWER(cif) = LOWER($1) LIMIT 1`,
      [companyCif]
    );

    if (existingCompany.length > 0) {
      companyId = existingCompany[0].id;
      console.log(`  -> Empresa encontrada existente con ID: ${companyId}`);
    } else {
      const newComp = await query<any>(
        `INSERT INTO companies (name, cif, contact_email, contact_phone, timezone)
         VALUES ($1, $2, $3, $4, 'Europe/Madrid')
         RETURNING id`,
        [companyName, companyCif, adminEmail, adminPhone || null]
      );
      companyId = newComp[0].id;
      console.log(`  -> Empresa creada exitosamente con ID: ${companyId}`);
    }

    console.log('[2/3] Verificando usuario administrador...');
    const existingUser = await query<any>(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [adminEmail]
    );

    if (existingUser.length > 0) {
      console.error(`\n❌ ERROR: Ya existe un usuario con el email ${adminEmail}`);
      process.exit(1);
    }

    console.log('[3/3] Generando hash seguro (Bcrypt) y creando cuenta...');
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const newUser = await query<any>(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, phone, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, first_name, last_name, role`,
      [companyId, adminEmail.toLowerCase(), passwordHash, adminFirstName || 'Admin', adminLastName || 'Principal', adminPhone || null, UserRole.ADMIN, UserStatus.ACTIVE]
    );

    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, 'INITIAL_ADMIN_CREATED', 'users', $2, '127.0.0.1', $3)`,
      [companyId, newUser[0].id, JSON.stringify({ email: adminEmail, createdVia: 'cli-setup' })]
    );

    console.log('\n======================================================');
    console.log('✅ ¡Administrador inicial configurado con éxito!');
    console.log(`  Empresa: ${companyName} (${companyCif})`);
    console.log(`  Usuario: ${newUser[0].first_name} ${newUser[0].last_name}`);
    console.log(`  Email:   ${newUser[0].email}`);
    console.log(`  Rol:     ${newUser[0].role}`);
    console.log('======================================================\n');
  } catch (error: any) {
    console.error('\n❌ ERROR durante la configuración:', error.message || error);
    process.exit(1);
  } finally {
    await dbPool.end();
  }
}

runSetupAdmin();
