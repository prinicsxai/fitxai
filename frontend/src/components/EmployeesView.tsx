import React, { useState } from 'react';
import { 
  UserPlus, 
  Search, 
  Edit2, 
  UserX, 
  UserCheck, 
  Eye, 
  Mail, 
  Phone, 
  Clock, 
  CheckCircle2, 
  XCircle,
  X
} from 'lucide-react';
import { EmployeeItem } from '../types';
import { apiRequest } from '../api/client';

interface EmployeesViewProps {
  employees: EmployeeItem[];
  onRefresh: () => void;
  onOpenDetail: (employee: EmployeeItem) => void;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  employees,
  onRefresh,
  onOpenDetail,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);

  // Formulario de Crear
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: 'TemporalPassword123!',
    phone: '',
    documentId: '',
    employeeCode: '',
    department: 'Operaciones',
    jobTitle: 'Técnico',
    schedule: 'Lunes a Viernes: 08:00 - 16:30',
  });

  // Formulario de Editar
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    department: '',
    jobTitle: '',
    schedule: '',
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Obtener departamentos únicos para el filtro
  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean))) as string[];

  // Filtrado
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = 
      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.document_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.employee_code && emp.employee_code.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = 
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && emp.is_active) ||
      (statusFilter === 'INACTIVE' && !emp.is_active);

    const matchesDept = 
      departmentFilter === 'ALL' || 
      emp.department === departmentFilter;

    return matchesSearch && matchesStatus && matchesDept;
  });

  // Crear Trabajador
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMessage(null);

    const res = await apiRequest('/employees', {
      method: 'POST',
      body: JSON.stringify(createForm),
    });

    if (res.success) {
      setShowCreateModal(false);
      setCreateForm({
        firstName: '',
        lastName: '',
        email: '',
        password: 'TemporalPassword123!',
        phone: '',
        documentId: '',
        employeeCode: '',
        department: 'Operaciones',
        jobTitle: 'Técnico',
        schedule: 'Lunes a Viernes: 08:00 - 16:30',
      });
      onRefresh();
    } else {
      setErrorMessage(res.error || 'Error al crear trabajador');
    }
    setActionLoading(false);
  };

  // Abrir Modal de Editar
  const handleOpenEdit = (emp: EmployeeItem) => {
    setEditingEmployee(emp);
    setEditForm({
      firstName: emp.first_name,
      lastName: emp.last_name,
      phone: emp.phone || '',
      department: emp.department || '',
      jobTitle: emp.job_title || '',
      schedule: emp.schedule || '',
    });
    setErrorMessage(null);
  };

  // Guardar Edición
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setActionLoading(true);
    setErrorMessage(null);

    const res = await apiRequest(`/employees/${editingEmployee.id}`, {
      method: 'PUT',
      body: JSON.stringify(editForm),
    });

    if (res.success) {
      setEditingEmployee(null);
      onRefresh();
    } else {
      setErrorMessage(res.error || 'Error al actualizar trabajador');
    }
    setActionLoading(false);
  };

  // Desactivar Trabajador
  const handleDeactivate = async (emp: EmployeeItem) => {
    if (!window.confirm(`¿Estás seguro de desactivar a ${emp.first_name} ${emp.last_name}? Sus sesiones se revocarán inmediatamente.`)) {
      return;
    }
    const res = await apiRequest(`/employees/${emp.id}`, {
      method: 'DELETE',
    });
    if (res.success) {
      onRefresh();
    } else {
      alert(res.error || 'Error al desactivar trabajador');
    }
  };

  // Reactivar Trabajador
  const handleReactivate = async (emp: EmployeeItem) => {
    const res = await apiRequest(`/employees/${emp.id}`, {
      method: 'PUT',
      body: JSON.stringify({ isActive: true }),
    });
    if (res.success) {
      onRefresh();
    } else {
      alert(res.error || 'Error al reactivar trabajador');
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de Acciones y Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Barra de Búsqueda */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, email, DNI o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Filtros de Estado y Departamento */}
        <div className="flex items-center space-x-2.5 overflow-x-auto">
          {/* Filtro Estado */}
          <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                statusFilter === 'ALL' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                statusFilter === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Activos
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                statusFilter === 'INACTIVE' ? 'bg-rose-500/20 text-rose-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Inactivos
            </button>
          </div>

          {/* Filtro Departamento */}
          {departments.length > 0 && (
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">Todos los Dptos.</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          )}

          {/* Botón Crear Trabajador */}
          <button
            onClick={() => {
              setErrorMessage(null);
              setShowCreateModal(true);
            }}
            className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-500/10 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Trabajador</span>
          </button>
        </div>
      </div>

      {/* Tabla de Trabajadores */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">
            Mostrando <strong className="text-slate-200">{filteredEmployees.length}</strong> trabajadores
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Trabajador</th>
                <th className="px-5 py-3.5">Contacto</th>
                <th className="px-5 py-3.5">Puesto y Dpto.</th>
                <th className="px-5 py-3.5">Horario</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    No se encontraron trabajadores con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-900/40 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-200">
                        {emp.first_name} {emp.last_name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        DNI: {emp.document_id} {emp.employee_code ? `· ${emp.employee_code}` : ''}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center space-x-1.5 text-slate-300">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate max-w-[180px]">{emp.email}</span>
                      </div>
                      {emp.phone && (
                        <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] mt-0.5">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{emp.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-200">{emp.job_title || 'General'}</div>
                      <div className="text-slate-500 text-[11px]">{emp.department || 'Operaciones'}</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span className="truncate max-w-[150px]">{emp.schedule || 'L-V 08:00 - 16:30'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        emp.is_active 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {emp.is_active ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Activo</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            <span>Inactivo</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {/* Abrir Ficha */}
                        <button
                          onClick={() => onOpenDetail(emp)}
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition"
                          title="Abrir Ficha de Personal"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Editar */}
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
                          title="Editar Trabajador"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Desactivar / Reactivar */}
                        {emp.is_active ? (
                          <button
                            onClick={() => handleDeactivate(emp)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                            title="Desactivar cuenta"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(emp)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition"
                            title="Reactivar trabajador"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Crear Trabajador */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>Dar de Alta a Nuevo Trabajador</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Apellidos *</label>
                  <input
                    type="text"
                    required
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Email Corporativo *</label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="+34 600 000 000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Documento (DNI/NIE) *</label>
                  <input
                    type="text"
                    required
                    value={createForm.documentId}
                    onChange={(e) => setCreateForm({ ...createForm, documentId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Código de Empleado</label>
                  <input
                    type="text"
                    placeholder="EMP-0042"
                    value={createForm.employeeCode}
                    onChange={(e) => setCreateForm({ ...createForm, employeeCode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Departamento</label>
                  <input
                    type="text"
                    value={createForm.department}
                    onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Puesto de Trabajo</label>
                  <input
                    type="text"
                    value={createForm.jobTitle}
                    onChange={(e) => setCreateForm({ ...createForm, jobTitle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">Horario Laboral Asignado</label>
                  <input
                    type="text"
                    value={createForm.schedule}
                    onChange={(e) => setCreateForm({ ...createForm, schedule: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">Contraseña Provisional de Acceso</label>
                  <input
                    type="text"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">El trabajador podrá cambiarla en su primer acceso.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/10"
                >
                  {actionLoading ? 'Creando...' : 'Crear Trabajador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Trabajador */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" />
                <span>Editar Ficha de {editingEmployee.first_name}</span>
              </h3>
              <button
                onClick={() => setEditingEmployee(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Apellidos</label>
                  <input
                    type="text"
                    required
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Departamento</label>
                  <input
                    type="text"
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Puesto de Trabajo</label>
                  <input
                    type="text"
                    value={editForm.jobTitle}
                    onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">Horario Asignado</label>
                  <input
                    type="text"
                    value={editForm.schedule}
                    onChange={(e) => setEditForm({ ...editForm, schedule: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-500 hover:bg-blue-400 text-white transition shadow-lg shadow-blue-500/10"
                >
                  {actionLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
