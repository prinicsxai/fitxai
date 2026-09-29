import React, { useEffect } from 'react';
import { 
  LogIn, 
  LogOut, 
  MapPin, 
  X, 
  Radio,
  Clock,
  ExternalLink 
} from 'lucide-react';
import { AttendanceRecordItem } from '../types';

export interface PunchNotificationData {
  id: string;
  title: string;       // "Nou fitxatge"
  workerName: string;  // "Marc Puig"
  punchType: string;   // "Entrada" / "Salida"
  time: string;        // "08:57"
  locationStatus: string; // "Ubicació registrada"
  record: AttendanceRecordItem;
}

interface RealtimeNotificationToastProps {
  notifications: PunchNotificationData[];
  onDismiss: (id: string) => void;
  onInspect: (record: AttendanceRecordItem) => void;
}

export const RealtimeNotificationToast: React.FC<RealtimeNotificationToastProps> = ({
  notifications,
  onDismiss,
  onInspect,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none">
      {notifications.map((item) => (
        <ToastItem 
          key={item.id} 
          item={item} 
          onDismiss={onDismiss} 
          onInspect={onInspect} 
        />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{
  item: PunchNotificationData;
  onDismiss: (id: string) => void;
  onInspect: (record: AttendanceRecordItem) => void;
}> = ({ item, onDismiss, onInspect }) => {
  const isCheckIn = item.punchType.toLowerCase().includes('entrada') || item.record.type === 'CHECK_IN';

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(item.id);
    }, 7000);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div 
      className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100 flex flex-col space-y-2.5 animate-in slide-in-from-bottom-5"
    >
      {/* Cabecera del aviso */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold text-slate-200 tracking-wide uppercase flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>{item.title}</span>
          </span>
        </div>
        <button
          onClick={() => onDismiss(item.id)}
          className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Cuerpo: Trabajador y Tipo de Fichaje */}
      <div className="flex items-start space-x-3">
        <div className={`p-2 rounded-xl mt-0.5 ${
          isCheckIn ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
        }`}>
          {isCheckIn ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-slate-100 truncate">
            {item.workerName}
          </h4>
          <div className="flex items-center space-x-2 text-xs text-slate-300 mt-0.5">
            <span className={`font-semibold ${isCheckIn ? 'text-emerald-400' : 'text-sky-400'}`}>
              {item.punchType}
            </span>
            <span>·</span>
            <span className="font-mono text-slate-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{item.time}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Pie: Estado de Ubicación y Acción Rápida */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span>{item.locationStatus}</span>
        </div>
        <button
          onClick={() => onInspect(item.record)}
          className="text-slate-400 hover:text-white font-semibold flex items-center space-x-1 transition"
        >
          <span>Ver ficha</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
