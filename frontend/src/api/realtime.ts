/**
 * FITXAI Real-Time SSE Client
 * Gestiona conexión persistente, reconexión automática con backoff,
 * deduplicación de eventos y despacho de avisos inmediatos.
 */

import { getStoredToken } from './client';
import { AttendanceRecordItem } from '../types';

export type RealtimeConnectionStatus = 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'reconnecting' 
  | 'error';

export interface RealtimePunchEvent {
  eventId: string;
  type: 'NEW_PUNCH';
  companyId: string;
  timestamp: string;
  record: AttendanceRecordItem;
  notification: {
    title: string;
    workerName: string;
    punchType: string;
    time: string;
    locationStatus: string;
  };
}

export type PunchEventListener = (event: RealtimePunchEvent) => void;
export type StatusChangeListener = (status: RealtimeConnectionStatus) => void;

export class RealtimeManager {
  private eventSource: EventSource | null = null;
  private status: RealtimeConnectionStatus = 'disconnected';
  private punchListeners: Set<PunchEventListener> = new Set();
  private statusListeners: Set<StatusChangeListener> = new Set();
  
  // Deduplicación de eventos para evitar procesar el mismo fichaje dos veces
  private seenEventIds: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectDelayMs = 15000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private manualDisconnect = false;

  constructor() {
    // Manejo de eventos de visibilidad y estado de red del navegador
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[REALTIME] Red detectada online. Reconectando canal en vivo...');
        this.reconnect();
      });
      window.addEventListener('offline', () => {
        console.log('[REALTIME] Red desconectada.');
        this.updateStatus('disconnected');
      });
    }
  }

  public getStatus(): RealtimeConnectionStatus {
    return this.status;
  }

  public subscribePunch(listener: PunchEventListener): () => void {
    this.punchListeners.add(listener);
    return () => this.punchListeners.delete(listener);
  }

  public subscribeStatus(listener: StatusChangeListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private updateStatus(newStatus: RealtimeConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      for (const listener of this.statusListeners) {
        try {
          listener(newStatus);
        } catch (e) {
          console.error('[REALTIME] Error en listener de estado:', e);
        }
      }
    }
  }

  /**
   * Conectar al canal SSE en tiempo real
   */
  public connect() {
    this.manualDisconnect = false;
    const token = getStoredToken();
    if (!token) {
      this.updateStatus('disconnected');
      return;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.updateStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      const streamUrl = `/api/v1/realtime/stream?token=${encodeURIComponent(token)}`;
      this.eventSource = new EventSource(streamUrl);

      // Evento de apertura exitosa
      this.eventSource.onopen = () => {
        console.log('[REALTIME] Canal de eventos en vivo conectado exitosamente.');
        this.reconnectAttempts = 0;
        this.updateStatus('connected');
      };

      // Recepción de confirmación inicial
      this.eventSource.addEventListener('connected', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          console.log('[REALTIME] Sesión SSE confirmada por el servidor:', data.clientId);
          this.updateStatus('connected');
        } catch (_) {}
      });

      // Recepción de NUEVO FICHAJE EN TIEMPO REAL
      this.eventSource.addEventListener('NEW_PUNCH', (e: MessageEvent) => {
        try {
          const payload: RealtimePunchEvent = JSON.parse(e.data);
          
          // DEDUPLICACIÓN ESTRICTA
          if (payload.eventId && this.seenEventIds.has(payload.eventId)) {
            console.log('[REALTIME] Evento duplicado ignorado:', payload.eventId);
            return;
          }

          if (payload.eventId) {
            this.seenEventIds.add(payload.eventId);
            // Mantener un histórico razonable en memoria
            if (this.seenEventIds.size > 200) {
              const first = this.seenEventIds.values().next().value;
              if (first) this.seenEventIds.delete(first);
            }
          }

          console.log('[REALTIME] Fichaje en tiempo real recibido:', payload.record.id, payload.notification.workerName);

          // Notificar a todos los escuchas (App, Dashboard, Tabla)
          for (const listener of this.punchListeners) {
            try {
              listener(payload);
            } catch (err) {
              console.error('[REALTIME] Error en listener de fichaje:', err);
            }
          }
        } catch (err) {
          console.error('[REALTIME] Error parseando evento NEW_PUNCH:', err);
        }
      });

      // Manejo de errores y desconexiones
      this.eventSource.onerror = (err) => {
        console.warn('[REALTIME] Error o desconexión en el canal SSE:', err);
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        if (!this.manualDisconnect) {
          this.updateStatus('reconnecting');
          this.scheduleReconnect();
        } else {
          this.updateStatus('disconnected');
        }
      };
    } catch (err) {
      console.error('[REALTIME] Fallo al crear EventSource:', err);
      this.updateStatus('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Planifica un intento de reconexión con retardo exponencial
   */
  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    // Backoff: 1s, 2s, 4s, 8s, hasta 15s
    const delay = Math.min(1000 * Math.pow(1.8, this.reconnectAttempts - 1), this.maxReconnectDelayMs);
    console.log(`[REALTIME] Reintentando conexión en ${(delay / 1000).toFixed(1)}s (intento ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      if (!this.manualDisconnect) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Forzar reconexión inmediata
   */
  public reconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.connect();
  }

  /**
   * Desconexión manual (por ejemplo al cerrar sesión)
   */
  public disconnect() {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.updateStatus('disconnected');
  }
}

export const realtimeManager = new RealtimeManager();
