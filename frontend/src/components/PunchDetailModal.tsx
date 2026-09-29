import React from 'react';
import { 
  X, 
  MapPin, 
  LogIn, 
  LogOut, 
  Calendar, 
  Clock, 
  User, 
  Building2, 
  Compass, 
  ShieldCheck, 
  AlertTriangle, 
  ExternalLink,
  Smartphone,
  Globe
} from 'lucide-react';
import { AttendanceRecordItem } from '../types';

interface PunchDetailModalProps {
  record: AttendanceRecordItem | null;
  onClose: () => void;
}

export const PunchDetailModal: React.FC<PunchDetailModalProps> = ({ record, onClose }) => {
  if (!record) return null;

  const isCheckIn = record.type === 'CHECK_IN';
  const hasGps = typeof record.latitude === 'number' && typeof record.longitude === 'number';
  const accuracy = record.accuracy || 0;
  const isGoodAccuracy = accuracy > 0 && accuracy <= 100;

  const dateStr = record.fecha || new Date(record.timestamp).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const timeStr = record.hora || new Date(record.timestamp).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl border ${
              isCheckIn 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
            }`}>
              {isCheckIn ? <LogIn className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Detalle Oficial de Fichaje</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  isCheckIn 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                }`}>
                  {isCheckIn ? 'ENTRADA' : 'SALIDA'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">ID: {record.id}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Scrolleable */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Grid de Datos Clave: Quién, Qué, Cuándo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tarjeta Trabajador */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <User className="w-4 h-4" />
                <span>Trabajador</span>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-100">
                  {record.first_name} {record.last_name}
                </h4>
                <div className="mt-1 space-y-0.5 text-xs text-slate-400">
                  <p><span className="text-slate-500">Documento / DNI:</span> {record.document_id}</p>
                  {record.employee_code && (
                    <p><span className="text-slate-500">Cód. Empleado:</span> {record.employee_code}</p>
                  )}
                  {record.department && (
                    <p><span className="text-slate-500">Departamento:</span> {record.department}</p>
                  )}
                  {record.job_title && (
                    <p><span className="text-slate-500">Puesto:</span> {record.job_title}</p>
                  )}
                  <p className="flex items-center gap-1 mt-1 text-slate-400">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{record.company_name}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Tarjeta Fecha y Hora Oficial del Servidor */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Fecha y Hora Oficial (Servidor)</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                  <div className="flex items-center space-x-2 text-slate-300 text-xs">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span>Fecha Oficial:</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-100">{dateStr}</span>
                </div>
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                  <div className="flex items-center space-x-2 text-slate-300 text-xs">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>Hora Exacta:</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-emerald-400">{timeStr}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Timestamp inmutable certificado por el backend central ({record.timestamp}).
                </p>
              </div>
            </div>
          </div>

          {/* Tarjeta Coordenadas y Precisión GPS */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <MapPin className="w-4 h-4" />
                <span>Ubicación GPS Puntual</span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1 ${
                isGoodAccuracy 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}>
                {isGoodAccuracy ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                <span>Precisión: ±{accuracy.toFixed(1)} m</span>
              </span>
            </div>

            {hasGps ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                  <span className="text-slate-500 block text-[11px]">Latitud:</span>
                  <span className="font-mono text-slate-200 font-bold">{record.latitude?.toFixed(6)}</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                  <span className="text-slate-500 block text-[11px]">Longitud:</span>
                  <span className="font-mono text-slate-200 font-bold">{record.longitude?.toFixed(6)}</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                  <span className="text-slate-500 block text-[11px]">Margen de Error:</span>
                  <span className="font-mono text-emerald-400 font-bold">±{accuracy.toFixed(1)} metros</span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-900 rounded-lg text-slate-500 text-xs">
                Sin coordenadas GPS registradas en este evento.
              </div>
            )}

            {/* Metadatos técnicos de origen */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
              <div className="flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span>IP Origen: <strong className="font-mono text-slate-300">{record.ip_origen || 'Auditada'}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                <span>Dispositivo: <strong className="text-slate-300">{record.dispositivo || 'App Móvil Oficial'}</strong></span>
              </div>
            </div>
          </div>

          {/* Mapa con el Punto Exacto (Sin Rutas) */}
          {hasGps && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
                  <Compass className="w-4 h-4 text-emerald-400" />
                  <span>Punto Exacto del Fichaje (Visualización Aislada)</span>
                </div>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${record.latitude}&mlon=${record.longitude}#map=18/${record.latitude}/${record.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center space-x-1 text-xs transition"
                >
                  <span>Abrir en OpenStreetMap</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Contenedor del Mapa Embebido */}
              <div className="relative h-64 w-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                <iframe
                  title="Punto Exacto Fichaje"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight={0}
                  marginWidth={0}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${(record.longitude || 0) - 0.005}%2C${(record.latitude || 0) - 0.003}%2C${(record.longitude || 0) + 0.005}%2C${(record.latitude || 0) + 0.003}&layer=mapnik&marker=${record.latitude}%2C${record.longitude}`}
                  className="w-full h-full opacity-90 contrast-125"
                />
                
                {/* Badge Flotante Informativo */}
                <div className="absolute top-3 left-3 bg-slate-950/90 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg text-[11px] shadow-lg flex items-center space-x-2 text-slate-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Punto puntual verificado</span>
                </div>
              </div>

              <div className="p-2.5 bg-emerald-950/20 border border-emerald-800/30 rounded-lg text-[11px] text-emerald-300/80 leading-relaxed">
                <strong>Protección de Privacidad:</strong> El mapa representa únicamente el punto puntual del instante del clic. Está estrictamente prohibido el trazado de rutas, líneas de movimiento o trayectorias para garantizar el cumplimiento normativo.
              </div>
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Cerrar Detalle
          </button>
        </div>
      </div>
    </div>
  );
};
