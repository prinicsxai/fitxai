import React, { useState } from 'react';
import { 
  Search, 
  MapPin, 
  LogIn, 
  LogOut, 
  CheckCircle2, 
  Filter, 
  RefreshCw
} from 'lucide-react';
import { AttendanceRecordItem, EmployeeItem } from '../types';

interface AttendanceViewProps {
  records: AttendanceRecordItem[];
  employees: EmployeeItem[];
  onRefresh: () => void;
  onViewLocation: (record: AttendanceRecordItem) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  records,
  employees,
  onRefresh,
  onViewLocation,
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const departments = Array.from(new Set(records.map(r => r.department).filter(Boolean))) as string[];

  // Filtrado de registros en vivo
  const filteredRecords = records.filter((r) => {
    const matchesEmp = selectedEmployee === 'ALL' || r.employee_id === selectedEmployee;
    const matchesType = selectedType === 'ALL' || r.type === selectedType;
    const matchesDate = !selectedDate || r.timestamp.startsWith(selectedDate);
    const matchesDept = selectedDept === 'ALL' || r.department === selectedDept;
    const matchesSearch = 
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.document_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.employee_code && r.employee_code.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesEmp && matchesType && matchesDate && matchesDept && matchesSearch;
  });

  const clearFilters = () => {
    setSelectedEmployee('ALL');
    setSelectedType('ALL');
    setSelectedDate('');
    setSelectedDept('ALL');
    setSearchTerm('');
  };

  return (
    <div className="space-y-5">
      {/* Barra de Filtros */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span>Filtros de Búsqueda de Fichajes</span>
          </div>
          {(selectedEmployee !== 'ALL' || selectedType !== 'ALL' || selectedDate || selectedDept !== 'ALL' || searchTerm) && (
            <button
              onClick={clearFilters}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium transition"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Búsqueda por texto */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar trabajador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Filtro por Trabajador */}
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todos los trabajadores</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name}
              </option>
            ))}
          </select>

          {/* Filtro por Tipo: ENTRADA / SALIDA */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Tipo: Entradas y Salidas</option>
            <option value="CHECK_IN">🟢 Solo Entradas</option>
            <option value="CHECK_OUT">🔵 Solo Salidas</option>
          </select>

          {/* Filtro por Fecha */}
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Filtro por Departamento */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todos los Dptos.</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de Fichajes */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">
            Mostrando <strong className="text-slate-200">{filteredRecords.length}</strong> fichajes auditados
          </span>
          <button
            onClick={onRefresh}
            className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Trabajador</th>
                <th className="px-5 py-3.5">Tipo</th>
                <th className="px-5 py-3.5">Fecha</th>
                <th className="px-5 py-3.5">Hora Exacta</th>
                <th className="px-5 py-3.5">Ubicación GPS Puntual</th>
                <th className="px-5 py-3.5">Precisión GPS</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                    No se han encontrado fichajes con los filtros especificados.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/40 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-200">
                        {r.first_name} {r.last_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {r.document_id} {r.department ? `· ${r.department}` : ''}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {r.type === 'CHECK_IN' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <LogIn className="w-3.5 h-3.5" />
                          <span>ENTRADA</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          <LogOut className="w-3.5 h-3.5" />
                          <span>SALIDA</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-300">
                      {new Date(r.timestamp).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-200 font-semibold">
                      {new Date(r.timestamp).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5 font-mono">
                      {r.latitude && r.longitude ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-400">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">Sin coordenadas</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono">
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700/60 text-[11px]">
                        ±{r.accuracy ? r.accuracy.toFixed(1) : 0} m
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center space-x-1 text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verificado</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {r.latitude && r.longitude && (
                        <button
                          onClick={() => onViewLocation(r)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-slate-800 text-[11px] font-semibold transition"
                        >
                          Ver en Mapa
                        </button>
                      )}
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
