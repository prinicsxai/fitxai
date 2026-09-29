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
