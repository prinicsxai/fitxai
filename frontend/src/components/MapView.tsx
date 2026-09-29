import React, { useState } from 'react';
import { 
  MapPin, 
  ShieldCheck, 
  ExternalLink
} from 'lucide-react';
import { AttendanceRecordItem } from '../types';

interface MapViewProps {
  records: AttendanceRecordItem[];
  selectedRecordFromProps?: AttendanceRecordItem | null;
}

export const MapView: React.FC<MapViewProps> = ({
  records,
  selectedRecordFromProps,
}) => {
  // Filtrar solo los registros que tienen coordenadas GPS válidas
  const recordsWithLocation = records.filter(r => r.latitude && r.longitude);

  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecordItem | null>(
    selectedRecordFromProps || recordsWithLocation[0] || null
  );

  const active = selectedRecord || recordsWithLocation[0] || null;

  return (
    <div className="space-y-5">
      {/* Banner de Política Legal y Privacidad del Mapa */}
      <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-2xl p-4 flex items-start space-x-3.5 shadow-sm">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-200/90 leading-relaxed">
          <strong className="text-emerald-300 font-semibold">Aviso de Privacidad y Geolocalización Puntual:</strong>
          {' '}Este mapa <strong>NO representa trabajadores en tiempo real ni realiza seguimiento de rutas</strong>.
          Muestra únicamente las coordenadas puntuales registradas en el instante exacto en que se pulsó "Fichar".
          Tras cada registro, el sensor GPS se desconectó de forma inmediata.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Panel Izquierdo: Selector de Puntos de Fichaje */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col h-[560px]">
          <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Puntos de Fichaje Puntuales</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Selecciona un fichaje para situarlo en el mapa</p>
            </div>
            <span className="text-xs bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">
              {recordsWithLocation.length} puntos
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 mt-2 pr-1">
            {recordsWithLocation.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No hay fichajes con coordenadas GPS registradas todavía.
              </div>
            ) : (
              recordsWithLocation.map((r) => {
                const isSelected = active?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRecord(r)}
                    className={`w-full text-left p-3 rounded-xl transition my-1 flex items-start space-x-3 ${
                      isSelected 
                        ? 'bg-emerald-500/15 border border-emerald-500/30' 
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="mt-0.5">
                      {r.type === 'CHECK_IN' ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 block ring-4 ring-emerald-500/20" />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-400 block ring-4 ring-sky-500/20" />
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 truncate">
                          {r.first_name} {r.last_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(r.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                        <span className={r.type === 'CHECK_IN' ? 'text-emerald-400 font-semibold' : 'text-sky-400 font-semibold'}>
                          {r.type === 'CHECK_IN' ? 'Entrada' : 'Salida'}
                        </span>
                        <span>·</span>
                        <span className="font-mono text-slate-400">±{r.accuracy ? r.accuracy.toFixed(0) : 0}m prec.</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate mt-1">
                        GPS: {r.latitude?.toFixed(5)}, {r.longitude?.toFixed(5)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Panel Derecho: Mapa Interactivo OpenStreetMap y Ficha del Punto */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[560px]">
          {active && active.latitude && active.longitude ? (
            <>
              {/* Mapa embebido de OpenStreetMap centrado en la coordenada puntual */}
              <div className="flex-1 relative bg-slate-900 overflow-hidden">
                <iframe
                  title="Mapa de Fichaje Puntual"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight={0}
                  marginWidth={0}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${active.longitude - 0.005}%2C${active.latitude - 0.003}%2C${active.longitude + 0.005}%2C${active.latitude + 0.003}&layer=mapnik&marker=${active.latitude}%2C${active.longitude}`}
                  className="w-full h-full opacity-90 contrast-125"
                />

                {/* Badge flotante de ubicación puntual */}
                <div className="absolute top-4 left-4 bg-slate-950/90 backdrop-blur border border-slate-800 px-3.5 py-2 rounded-xl text-xs shadow-xl flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-slate-200 font-medium">Punto de Fichaje Aislado</span>
                </div>
              </div>

              {/* Detalle del Fichaje Seleccionado */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-100 text-sm">
                      {active.first_name} {active.last_name}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      active.type === 'CHECK_IN' 
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                    }`}>
                      {active.type === 'CHECK_IN' ? 'ENTRADA' : 'SALIDA'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Fecha y Hora: {new Date(active.timestamp).toLocaleString('es-ES')} · Precisión GPS: ±{active.accuracy?.toFixed(1)} metros
                  </p>
                </div>

                <a
                  href={`https://www.openstreetmap.org/?mlat=${active.latitude}&mlon=${active.longitude}#map=18/${active.latitude}/${active.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-slate-800 transition font-semibold"
                >
                  <span>Abrir en OpenStreetMap</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
              <MapPin className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm font-medium text-slate-400">Sin datos de geolocalización seleccionados</p>
              <p className="text-xs text-slate-600 max-w-sm mt-1">
                Cuando los trabajadores fichen con GPS puntual activo en su aplicación móvil, los puntos aparecerán aquí.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
