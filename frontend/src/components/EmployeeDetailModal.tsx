import React, { useEffect, useState } from 'react';
import { 
  X, 
  Mail, 
  Phone, 
  Briefcase, 
  Building, 
  Calendar, 
  Clock, 
  MapPin, 
  LogIn, 
  LogOut,
  RefreshCw
} from 'lucide-react';
import { EmployeeItem, AttendanceRecordItem } from '../types';
import { apiRequest } from '../api/client';

interface EmployeeDetailModalProps {
  employee: EmployeeItem | null;
  onClose: () => void;
  onEdit: (employee: EmployeeItem) => void;
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
  employee,
  onClose,
  onEdit,
}) => {
  const [history, setHistory] = useState<AttendanceRecordItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (employee) {
      loadHistory(employee.id);
    }
  }, [employee]);

  const loadHistory = async (empId: string) => {
    setLoadingHistory(true);
    const res = await apiRequest(`/employees/${empId}/attendance`);
    if (res.success && res.data) {
      setHistory(res.data);
    }
    setLoadingHistory(false);
  };

  if (!employee) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
        
        {/* Cabecera de la Ficha */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-950/60">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xl font-bold">
              {employee.first_name[0]}{employee.last_name[0]}
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-bold text-slate-100">
                  {employee.first_name} {employee.last_name}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  employee.is_active 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {employee.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {employee.employee_code || 'Sin código'} · DNI/NIE: {employee.document_id}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Datos Personales y Laborales */}
        <div className="p-6 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center space-x-2 text-slate-400 mb-1">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>Email Corporativo</span>
            </div>
            <p className="font-semibold text-slate-200 truncate">{employee.email}</p>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center space-x-2 text-slate-400 mb-1">
              <Phone className="w-3.5 h-3.5 text-slate-500" />
              <span>Teléfono</span>
            </div>
            <p className="font-semibold text-slate-200">{employee.phone || 'No especificado'}</p>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center space-x-2 text-slate-400 mb-1">
              <Briefcase className="w-3.5 h-3.5 text-slate-500" />
              <span>Puesto de Trabajo</span>
            </div>
            <p className="font-semibold text-slate-200">{employee.job_title || 'General'}</p>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center space-x-2 text-slate-400 mb-1">
              <Building className="w-3.5 h-3.5 text-slate-500" />
              <span>Departamento</span>
            </div>
            <p className="font-semibold text-slate-200">{employee.department || 'Operaciones'}</p>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center space-x-2 text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Horario Laboral</span>
            </div>
            <p className="font-semibold text-slate-200">{employee.schedule || 'L-V 08:00 - 16:30'}</p>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center space-x-2 text-slate-400 mb-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Fecha Incorporación</span>
            </div>
            <p className="font-semibold text-slate-200">
              {new Date(employee.hire_date).toLocaleDateString('es-ES')}
            </p>
          </div>
        </div>

        {/* Historial de Fichajes de este Trabajador */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Historial de Fichajes del Trabajador</span>
            </h3>
            <button
              onClick={() => loadHistory(employee.id)}
              disabled={loadingHistory}
              className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Recargar</span>
            </button>
          </div>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden max-h-64 overflow-y-auto">
            {history.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No hay fichajes registrados para este trabajador.
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 uppercase text-[10px] text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">Tipo</th>
                    <th className="px-4 py-2.5">Fecha y Hora</th>
                    <th className="px-4 py-2.5">Ubicación GPS Puntual</th>
                    <th className="px-4 py-2.5">Precisión</th>
                    <th className="px-4 py-2.5">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-900/30">
                      <td className="px-4 py-2.5">
                        {h.type === 'CHECK_IN' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400">
                            <LogIn className="w-3 h-3" />
                            <span>ENTRADA</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/10 text-sky-400">
                            <LogOut className="w-3 h-3" />
                            <span>SALIDA</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono">
                        {new Date(h.timestamp).toLocaleString('es-ES')}
                      </td>
                      <td className="px-4 py-2.5 font-mono">
                        {h.latitude && h.longitude ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-400">
                            <MapPin className="w-3 h-3" />
                            <span>{h.latitude.toFixed(4)}, {h.longitude.toFixed(4)}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">Sin GPS</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-400">
                        ±{h.accuracy ? h.accuracy.toFixed(1) : 0}m
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-emerald-400 font-medium">Verificado</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer del Modal */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              onEdit(employee);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
          >
            Editar Datos del Trabajador
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition"
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
};
