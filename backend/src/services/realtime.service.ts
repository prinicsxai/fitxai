import { Response } from 'express';
import crypto from 'crypto';

export interface SSEClient {
  id: string;
  userId: string;
  companyId: string;
  role: string;
  res: Response;
  connectedAt: Date;
  lastPingAt: number;
}

export interface RealtimePunchPayload {
  eventId: string;
  type: 'NEW_PUNCH';
  companyId: string;
  timestamp: string;
  record: {
    id: string;
    employee_id: string;
    first_name: string;
    last_name: string;
    document_id: string;
    employee_code?: string;
    department?: string;
    job_title?: string;
    company_id: string;
    company_name: string;
    type: 'CHECK_IN' | 'CHECK_OUT';
    tipo: 'ENTRADA' | 'SALIDA';
    timestamp: string;
    fecha: string;
    hora: string;
    status: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    ip_origen?: string;
    dispositivo?: string;
  };
  notification: {
    title: string;       // "Nou fitxatge"
    workerName: string;  // "Marc Puig"
    punchType: string;   // "Entrada" / "Salida"
    time: string;        // "08:57"
    locationStatus: string; // "Ubicació registrada"
  };
}

class RealtimeService {
  // Mapa de clientes indexado por companyId -> clientId -> SSEClient
  private companyClients: Map<string, Map<string, SSEClient>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Inicia el envío periódico de pings SSE para evitar timeouts de proxies/navegadores
   */
  private startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 25000);

    // Evitar que el timer impida que Node.js termine normalmente
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  /**
   * Envía un comentario SSE como ping de mantenimiento de conexión
   */
  private sendHeartbeat() {
    for (const [companyId, clients] of this.companyClients.entries()) {
      for (const [clientId, client] of clients.entries()) {
        try {
          client.res.write(': ping\n\n');
          client.lastPingAt = Date.now();
        } catch (err) {
          console.warn(`[REALTIME] Error enviando ping a cliente ${clientId} (empresa ${companyId}):`, err);
          this.removeClient(companyId, clientId);
        }
      }
    }
  }

  /**
   * Registra un nuevo suscriptor SSE autenticado
   */
  public registerClient(client: SSEClient) {
    if (!this.companyClients.has(client.companyId)) {
      this.companyClients.set(client.companyId, new Map());
    }

    const companyMap = this.companyClients.get(client.companyId)!;
    companyMap.set(client.id, client);

    console.log(
      `[REALTIME] Cliente SSE conectado: user=${client.userId}, company=${client.companyId}, id=${client.id}. Conexiones activas en empresa: ${companyMap.size}`
    );

    // Enviar evento inicial de conexión confirmada
    this.sendEventToClient(client, 'connected', {
      status: 'connected',
      clientId: client.id,
      companyId: client.companyId,
      serverTime: new Date().toISOString(),
    });
  }

  /**
   * Elimina un cliente desconectado
   */
  public removeClient(companyId: string, clientId: string) {
    const companyMap = this.companyClients.get(companyId);
    if (companyMap) {
      companyMap.delete(clientId);
      if (companyMap.size === 0) {
        this.companyClients.delete(companyId);
      }
      console.log(`[REALTIME] Cliente SSE desconectado: ${clientId} (empresa ${companyId})`);
    }
  }

  /**
   * Envía un evento a un cliente individual
   */
  private sendEventToClient(client: SSEClient, event: string, data: any, id?: string) {
    try {
      let message = '';
      if (id) {
        message += `id: ${id}\n`;
      }
      message += `event: ${event}\n`;
      message += `data: ${JSON.stringify(data)}\n\n`;
      client.res.write(message);
    } catch (err) {
      console.warn(`[REALTIME] Error enviando a cliente ${client.id}:`, err);
      this.removeClient(client.companyId, client.id);
    }
  }

  /**
   * Emite un evento de fichaje EN TIEMPO REAL a todos los administradores de la empresa
   * Aislamiento estricto: la Empresa B nunca recibe eventos de la Empresa A.
   */
  public emitPunchEvent(companyId: string, payload: Omit<RealtimePunchPayload, 'eventId'>): string {
    const eventId = crypto.randomUUID();
    const fullPayload: RealtimePunchPayload = {
      ...payload,
      eventId,
    };

    const companyMap = this.companyClients.get(companyId);
    const subscriberCount = companyMap ? companyMap.size : 0;

    console.log(
      `[REALTIME] Emitiendo evento NEW_PUNCH (${eventId}) para empresa ${companyId}. Destinatarios: ${subscriberCount}`
    );

    if (companyMap) {
      for (const client of companyMap.values()) {
        this.sendEventToClient(client, 'NEW_PUNCH', fullPayload, eventId);
      }
    }

    return eventId;
  }

  /**
   * Obtener número de clientes conectados en total o para una empresa específica
   */
  public getSubscriberCount(companyId?: string): number {
    if (companyId) {
      return this.companyClients.get(companyId)?.size || 0;
    }
    let total = 0;
    for (const clients of this.companyClients.values()) {
      total += clients.size;
    }
    return total;
  }

  /**
   * Detiene el heartbeat
   */
  public stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Limpiar todas las conexiones (para pruebas o shutdown)
   */
  public clearAll() {
    this.stopHeartbeat();
    for (const [companyId, clients] of this.companyClients.entries()) {
      for (const [clientId, client] of clients.entries()) {
        try {
          client.res.end();
        } catch (_) {}
      }
    }
    this.companyClients.clear();
  }
}

export const realtimeService = new RealtimeService();
