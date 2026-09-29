import { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { UserRole } from '@fitxai/shared';

const createCompanySchema = z.object({
  name: z.string().min(2, 'El nombre de la empresa debe tener al menos 2 caracteres'),
  cif: z.string().min(4, 'Identificador fiscal / CIF requerido'),
  contactEmail: z.string().email('Email de contacto inválido'),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  timezone: z.string().default('Europe/Madrid'),
});

/**
 * POST /companies
 * Registro de una nueva empresa en el sistema
 */
export async function createCompany(req: Request, res: Response) {
  try {
    const parseResult = createCompanySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validación de datos de empresa fallida',
        details: parseResult.error.errors,
      });
    }

    const { name, cif, contactEmail, contactPhone, address, timezone } = parseResult.data;

    // Comprobar si el CIF ya existe
    const existing = await query<any>(
      `SELECT id FROM companies WHERE LOWER(cif) = LOWER($1) LIMIT 1`,
      [cif]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Ya existe una empresa registrada con el CIF ${cif}`,
      });
    }

    const newCompany = await query<any>(
      `INSERT INTO companies (name, cif, contact_email, contact_phone, address, timezone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, cif, contact_email, contact_phone, address, timezone, is_active, created_at`,
      [name, cif, contactEmail, contactPhone || null, address || null, timezone]
    );

    // Si la llamada fue hecha por un usuario autenticado, registramos en auditoría
    if (req.user) {
      await query(
        `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address)
         VALUES ($1, $2, 'COMPANY_CREATED', 'companies', $1, $3)`,
        [newCompany[0].id, req.user.userId, req.ip]
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Empresa creada exitosamente',
      data: newCompany[0],
    });
  } catch (error: any) {
    console.error('Error creating company:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

/**
 * GET /companies
 * Obtiene los datos de la empresa del usuario autenticado (aislamiento estricto)
 */
export async function getCompanies(req: Request, res: Response) {
  try {
    const user = req.user!;

    // Si es ADMIN, sólo puede ver su propia empresa
    const companies = await query<any>(
      `SELECT id, name, cif, contact_email, contact_phone, address, timezone, is_active, created_at
       FROM companies 
       WHERE id = $1`,
      [user.companyId]
    );

    return res.json({
      success: true,
      data: companies,
    });
  } catch (error: any) {
    console.error('Error fetching companies:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

/**
 * GET /companies/settings
 * Obtiene la configuración de control horario y geolocalización puntual de la empresa
 */
export async function getCompanySettings(req: Request, res: Response) {
  try {
    const user = req.user!;
    const rows = await query<any>(
      `SELECT key, value, description FROM settings WHERE company_id = $1`,
      [user.companyId]
    );

    const settingsMap: Record<string, string> = {
      maxGpsAccuracyMeters: '150',
      requireGps: 'true',
      timezone: 'Europe/Madrid',
    };

    rows.forEach(r => {
      settingsMap[r.key] = r.value;
    });

    return res.json({
      success: true,
      data: settingsMap,
    });
  } catch (error: any) {
    console.error('Error fetching company settings:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener la configuración' });
  }
}

/**
 * PUT /companies/settings
 * Actualiza la configuración de la empresa con registro inmutable en audit_logs
 */
export async function updateCompanySettings(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { maxGpsAccuracyMeters, requireGps, timezone } = req.body;

    const beforeRows = await query<any>(
      `SELECT key, value FROM settings WHERE company_id = $1`,
      [user.companyId]
    );
    const beforeState: Record<string, string> = {};
    beforeRows.forEach(r => { beforeState[r.key] = r.value; });

    const updates: Array<{ key: string; value: string; desc: string }> = [];

    if (maxGpsAccuracyMeters !== undefined) {
      updates.push({
        key: 'maxGpsAccuracyMeters',
        value: String(maxGpsAccuracyMeters),
        desc: 'Umbral máximo en metros de precisión GPS puntual admisible',
      });
    }

    if (requireGps !== undefined) {
      updates.push({
        key: 'requireGps',
        value: String(requireGps),
        desc: 'Exigir obligatoriamente captura GPS puntual al pulsar Fichar',
      });
    }

    if (timezone !== undefined) {
      updates.push({
        key: 'timezone',
        value: String(timezone),
        desc: 'Zona horaria oficial de la empresa',
      });
      await query(`UPDATE companies SET timezone = $1, updated_at = NOW() WHERE id = $2`, [timezone, user.companyId]);
    }

    for (const item of updates) {
      await query(
        `INSERT INTO settings (company_id, key, value, description, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (company_id, key)
         DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW()`,
        [user.companyId, item.key, item.value, item.desc]
      );
    }

    // Registro inmutable de auditoría
    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, 'SETTINGS_UPDATED', 'settings', $1, $3, $4)`,
      [
        user.companyId,
        user.userId,
        req.ip,
        JSON.stringify({
          before: beforeState,
          after: { maxGpsAccuracyMeters, requireGps, timezone },
          updatedBy: user.email,
        }),
      ]
    );

    return res.json({
      success: true,
      message: 'Configuración actualizada exitosamente y registrada en auditoría',
      data: { maxGpsAccuracyMeters, requireGps, timezone },
    });
  } catch (error: any) {
    console.error('Error updating company settings:', error);
    return res.status(500).json({ success: false, error: 'Error al actualizar configuración' });
  }
}

