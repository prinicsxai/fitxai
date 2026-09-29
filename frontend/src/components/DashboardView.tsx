import React from 'react';
import { 
  Users, 
  UserCheck, 
  Clock, 
  LogIn, 
  LogOut, 
  Hourglass, 
  AlertTriangle, 
  MapPin, 
  CheckCircle2, 
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { DashboardStats, AttendanceRecordItem } from '../types';

interface DashboardViewProps {
  stats: DashboardStats;
  recentAttendance: AttendanceRecordItem[];
  onViewLocation: (record: AttendanceRecordItem) => void;
  onNavigateToAttendance: () => void;
  onNavigateToEmployees: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  recentAttendance,
  onViewLocation,
  onNavigateToAttendance,
  onNavigateToEmployees,
}) => {
  return (
    <div className="space-y-6">
      {/* Aviso de Privacidad / GPS Puntual */}
      <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-4 flex items-start space-x-3.5 shadow-sm">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-200/90 leading-relaxed">
          <strong className="text-emerald-300 font-semibold">Política de Fichaje y Protección de Privacidad:</strong>
          {' '}El sistema solo adquiere coordenadas GPS en el instante exacto en que el trabajador presiona "Fichar Entrada" o "Fichar Salida". 
          El sensor se apaga de inmediato. Prohibido el seguimiento en segundo plano, rutas o monitorización continua.
        </div>
      </div>

      {/* Grid de Métricas Principales (7 métricas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Trabajadores */}
        <div 
          onClick={onNavigateToEmployees}
          className="bg-slate-950 border border-slate-800/80 hover:border-slate-700 p-4 rounded-2xl transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Trabajadores</span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-105 transition">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-100 mt-2">{stats.totalEmployees}</p>
          <p className="text-[11px] text-slate-500 mt-1">Plantilla global registrada</p>
        </div>

        {/* 2. Trabajadores Activos */}
        <div 
          onClick={onNavigateToEmployees}
          className="bg-slate-950 border border-slate-800/80 hover:border-slate-700 p-4 rounded-2xl transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Trabajadores Activos</span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2">{stats.activeEmployees}</p>
          <p className="text-[11px] text-slate-500 mt-1">Con contrato activo</p>
        </div>

        {/* 3. Fichajes de Hoy */}
        <div 
          onClick={onNavigateToAttendance}
          className="bg-slate-950 border border-slate-800/80 hover:border-slate-700 p-4 rounded-2xl transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fichajes de Hoy</span>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-105 transition">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-purple-300 mt-2">{stats.todayPunches}</p>
          <p className="text-[11px] text-slate-500 mt-1">Eventos registrados hoy</p>
        </div>

        {/* 4. Horas Trabajadas Hoy */}
        <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Horas Computadas</span>
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Hourglass className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-teal-300 mt-2">{stats.todayHoursWorked}h</p>
          <p className="text-[11px] text-slate-500 mt-1">Tiempo efectivo acumulado</p>
        </div>
      </div>

      {/* Fila secundaria de métricas: Entradas, Salidas e Incidencias */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Entradas de hoy */}
        <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-2xl flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <LogIn className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Entradas de Hoy</p>
            <p className="text-2xl font-bold text-slate-100">{stats.todayCheckIns}</p>
          </div>
        </div>

        {/* Salidas de hoy */}
        <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-2xl flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Salidas de Hoy</p>
            <p className="text-2xl font-bold text-slate-100">{stats.todayCheckOuts}</p>
          </div>
        </div>

        {/* Incidencias pendientes */}
        <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-2xl flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Incidencias Pendientes</p>
            <p className="text-2xl font-bold text-amber-300">{stats.pendingIncidents}</p>
          </div>
        </div>
      </div>

      {/* Sección: Últimos Fichajes */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-100">Últimos Fichajes Registrados</h2>
            <p className="text-xs text-slate-400 mt-0.5">Control en vivo de entradas y salidas con ubicación GPS puntual</p>
          </div>
          <button
            onClick={onNavigateToAttendance}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            Ver todos los fichajes &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Trabajador</th>
                <th className="px-5 py-3.5">Tipo</th>
                <th className="px-5 py-3.5">Fecha y Hora</th>
                <th className="px-5 py-3.5">Ubicación GPS</th>
                <th className="px-5 py-3.5">Precisión</th>
                <th className="px-5 py-3.5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentAttendance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-xs">
                    No se han registrado fichajes hoy en la empresa.
                  </td>
                </tr>
              ) : (
                recentAttendance.slice(0, 10).map((record) => (
                  <tr key={record.id} className="hover:bg-slate-900/40 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-200">
                        {record.first_name} {record.last_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {record.document_id} · {record.department || 'General'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {record.type === 'CHECK_IN' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <LogIn className="w-3.5 h-3.5" />
                          <span>ENTRADA</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          <LogOut className="w-3.5 h-3.5" />
                          <span>SALIDA</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-300">
                      <div>
                        {new Date(record.timestamp).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        {new Date(record.timestamp).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {record.latitude && record.longitude ? (
                        <button
                          onClick={() => onViewLocation(record)}
                          className="inline-flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 transition underline font-mono"
                        >
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </button>
                      ) : (
                        <span className="text-slate-500">Sin datos GPS</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono">
                      <span className="bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded border border-slate-700/60">
                        ±{record.accuracy ? record.accuracy.toFixed(1) : 0} m
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center space-x-1 text-xs text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verificado</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
