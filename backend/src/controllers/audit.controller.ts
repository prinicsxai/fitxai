import { Request, Response } from 'express';
import { query } from '../db/pool';

/**
 * GET /audit/logs
 * Listado de registros inmutables de auditoría de la empresa
 * Filtros opcionales: action, userId, startDate, endDate, limit, offset
 */
export async function getAuditLogs(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { action, userId, startDate, endDate, limit = '50', offset = '0' } = req.query as Record<string, string>;

    const conditions = ['a.company_id = $1'];
    const params: any[] = [user.companyId];
    let pIdx = 2;

    if (action && action !== 'ALL') {
      conditions.push(`a.action = $${pIdx}`);
      params.push(action);
      pIdx++;
    }

    if (userId) {
      conditions.push(`a.user_id = $${pIdx}`);
      params.push(userId);
      pIdx++;
    }

    if (startDate) {
      conditions.push(`a.created_at >= $${pIdx}`);
      params.push(new Date(startDate));
      pIdx++;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(`a.created_at <= $${pIdx}`);
      params.push(end);
      pIdx++;
    }

    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);

    params.push(parsedLimit);
    const limitIdx = pIdx++;
    params.push(parsedOffset);
    const offsetIdx = pIdx++;

    const rows = await query<any>(
      `SELECT 
        a.id,
        a.company_id,
        a.user_id,
        a.action,
        a.entity_type,
        a.entity_id,
        a.ip_address,
        a.metadata,
        a.created_at,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.role as user_role
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    // Conteo total para paginación
    const countRows = await query<any>(
      `SELECT COUNT(*)::int as total
       FROM audit_logs a
       WHERE ${conditions.join(' AND ')}`,
      params.slice(0, pIdx - 3)
    );

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0]?.total || 0,
        limit: parsedLimit,
        offset: parsedOffset,
      },
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener registros de auditoría' });
  }
}
