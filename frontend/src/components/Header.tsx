import React from 'react';
import { Menu, RefreshCw, Database, Radio, WifiOff } from 'lucide-react';
import { SidebarSection } from '../types';
import { RealtimeConnectionStatus } from '../api/realtime';

interface HeaderProps {
  activeSection: SidebarSection;
  onOpenMobile: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  dbStatus: 'connected' | 'error' | 'checking';
  latencyMs?: number;
  realtimeStatus?: RealtimeConnectionStatus;
  onReconnectRealtime?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeSection,
  onOpenMobile,
  onRefresh,
  isRefreshing,
  dbStatus,
  latencyMs,
  realtimeStatus = 'disconnected',
  onReconnectRealtime,
}) => {
  const titles: Record<SidebarSection, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard General', subtitle: 'Métricas de jornada y control en tiempo real' },
    employees: { title: 'Gestión de Trabajadores', subtitle: 'Directorio, altas, bajas y fichas de personal' },
    attendance: { title: 'Registro de Fichajes', subtitle: 'Histórico auditado con coordenadas y hora exacta' },
    map: { title: 'Mapa de Fichajes Puntuales', subtitle: 'Puntos geográficos exactos donde se realizó cada fichaje' },
    schedules: { title: 'Horarios y Turnos', subtitle: 'Configuración de jornadas laborales por departamento' },
    reports: { title: 'Informes y Liquidación', subtitle: 'Cómputo de horas ordinarias y cumplimiento legal' },
    incidents: { title: 'Monitor de Incidencias', subtitle: 'Alertas de geolocalización degradada y discrepancias' },
    audit: { title: 'Trazabilidad y Auditoría', subtitle: 'Registro inmutable de accesos y operaciones' },
    settings: { title: 'Configuración de Empresa', subtitle: 'Políticas de fichaje, tolerancia GPS y datos fiscales' },
    account: { title: 'Mi Perfil de Administrador', subtitle: 'Credenciales de acceso y preferencias' },
  };

  const current = titles[activeSection] || { title: 'Panel de Control', subtitle: '' };

  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            {current.title}
          </h1>
          <p className="text-xs text-slate-400 hidden sm:block">
            {current.subtitle}
          </p>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center space-x-3.5">
        {/* Live SSE Stream Badge */}
        <div 
          onClick={realtimeStatus !== 'connected' ? onReconnectRealtime : undefined}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs transition cursor-default ${
            realtimeStatus === 'connected'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : realtimeStatus === 'reconnecting'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400 cursor-pointer hover:bg-rose-500/20'
          }`}
          title={realtimeStatus !== 'connected' ? 'Haz clic para reconectar el canal en vivo' : 'Canal en vivo activo'}
        >
          {realtimeStatus === 'connected' ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-[11px] hidden sm:inline">En vivo</span>
            </>
          ) : realtimeStatus === 'reconnecting' ? (
            <>
              <Radio className="w-3.5 h-3.5 animate-spin" />
              <span className="font-semibold text-[11px] hidden sm:inline">Reconectando...</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span className="font-semibold text-[11px] hidden sm:inline">Desconectado</span>
            </>
          )}
        </div>

        {/* DB Connection Badge */}
        <div className="hidden md:flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-xs">
          <Database className="w-3.5 h-3.5 text-slate-400" />
          <span className={`w-2 h-2 rounded-full ${
            dbStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
          }`} />
          <span className="text-slate-300 font-medium">
            DB: {dbStatus === 'connected' ? `Online (${latencyMs || 1}ms)` : 'Conectando...'}
          </span>
        </div>

        {/* Reload button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition shadow-sm"
          title="Actualizar datos"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>
    </header>
  );
};
