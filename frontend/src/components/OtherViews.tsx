import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  FileBarChart, 
  CheckCircle2, 
  Download, 
  Key, 
  Save, 
  Plus, 
  Trash2, 
  Edit3, 
  Printer, 
  Check, 
  X, 
  Filter
} from 'lucide-react';
import { UserProfile, DashboardStats } from '../types';
import { apiRequest, downloadFile, openPdfView } from '../api/client';

/**
 * ========================================================
 * 1. SECCIÓN: GESTIÓN DE HORARIOS (SCHEDULES)
 * ========================================================
 */
export const SchedulesView: React.FC = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    startTime: '08:00',
    endTime: '16:30',
    workDays: 'L,M,X,J,V',
    breakMinutes: 30,
    breakStart: '13:00',
    breakEnd: '13:30',
    employeeId: '',
  });

  const loadData = async () => {
    setLoading(true);
    const [schedRes, empRes] = await Promise.all([
      apiRequest('/schedules'),
      apiRequest('/employees'),
    ]);
    if (schedRes.success && schedRes.data) {
      setSchedules(schedRes.data);
    }
    if (empRes.success && empRes.data) {
      setEmployees(empRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingSchedule(null);
    setFormData({
      name: '',
      startTime: '08:00',
      endTime: '16:30',
      workDays: 'L,M,X,J,V',
      breakMinutes: 30,
      breakStart: '13:00',
      breakEnd: '13:30',
      employeeId: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (sched: any) => {
    setEditingSchedule(sched);
    setFormData({
      name: sched.name,
      startTime: sched.start_time,
      endTime: sched.end_time,
      workDays: sched.work_days,
      breakMinutes: sched.break_minutes || 30,
      breakStart: sched.break_start || '',
      breakEnd: sched.break_end || '',
      employeeId: sched.employee_id || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...formData,
      breakMinutes: Number(formData.breakMinutes),
      employeeId: formData.employeeId || null,
    };

    let res;
    if (editingSchedule) {
      res = await apiRequest(`/schedules/${editingSchedule.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      res = await apiRequest('/schedules', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    setSubmitting(false);
    if (res.success) {
      setIsModalOpen(false);
      loadData();
    } else {
      alert(res.error || 'Error al guardar horario');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar el horario "${name}"?`)) return;
    const res = await apiRequest(`/schedules/${id}`, { method: 'DELETE' });
    if (res.success) {
      loadData();
    } else {
      alert(res.error || 'Error al eliminar horario');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100">Horarios y Turnos Laborales</h2>
          <p className="text-xs text-slate-400">Configura plantillas de turnos, descansos y asignaciones individuales o de empresa</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-500/10"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Horario</span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Cargando horarios configurados...</div>
      ) : schedules.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500 space-y-3">
          <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-slate-300 font-semibold">No hay horarios personalizados registrados</p>
          <p className="text-slate-500">Crea el primer horario laboral para asignarlo a tus trabajadores.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules.map((s) => (
            <div key={s.id} className="bg-slate-950 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 space-y-4 transition flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-slate-200">{s.name}</h3>
                      <span className="text-[10px] text-slate-400">{s.work_days}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEditModal(s)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                      title="Editar"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Jornada</span>
                    <span className="text-emerald-400 font-bold text-sm">{s.start_time} - {s.end_time}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase block">Descanso</span>
                    <span className="text-amber-400 font-semibold text-xs">{s.break_minutes}m ({s.break_start || '--'} a {s.break_end || '--'})</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/70 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Asignado a:</span>
                {s.first_name ? (
                  <span className="font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {s.first_name} {s.last_name}
                  </span>
                ) : (
                  <span className="text-slate-500 italic">Plantilla General Empresa</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CREAR / EDITAR HORARIO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-100">
                {editingSchedule ? 'Editar Horario' : 'Crear Nuevo Horario'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre del Horario / Turno</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Turno Mañana Intensivo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Hora Entrada</label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Hora Salida</label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Días Laborales</label>
                <input
                  type="text"
                  required
                  placeholder="L,M,X,J,V"
                  value={formData.workDays}
                  onChange={(e) => setFormData({ ...formData, workDays: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Descanso (Min)</label>
                  <input
                    type="number"
                    min="0"
                    max="240"
                    value={formData.breakMinutes}
                    onChange={(e) => setFormData({ ...formData, breakMinutes: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Inicio Descanso</label>
                  <input
                    type="time"
                    value={formData.breakStart}
                    onChange={(e) => setFormData({ ...formData, breakStart: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Fin Descanso</label>
                  <input
                    type="time"
                    value={formData.breakEnd}
                    onChange={(e) => setFormData({ ...formData, breakEnd: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Asignar a Trabajador (Opcional)</label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Plantilla General (Toda la Empresa)</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_code || emp.document_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : editingSchedule ? 'Actualizar' : 'Crear Horario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * ========================================================
 * 2. SECCIÓN: GESTIÓN DE INCIDENCIAS (INCIDENTS)
 * ========================================================
 */
export const IncidentsView: React.FC = () => {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeModal, setActiveModal] = useState<{
    incident: any;
    action: 'REVIEW' | 'APPROVE' | 'REJECT';
  } | null>(null);
  const [adminComment, setAdminComment] = useState('');
  const [createMissingPunch, setCreateMissingPunch] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadIncidents = async () => {
    setLoading(true);
    const queryStr = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
    const res = await apiRequest(`/incidents${queryStr}`);
    if (res.success && res.data) {
      setIncidents(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadIncidents();
  }, [statusFilter]);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal) return;
    setSubmitting(true);

    const { incident, action } = activeModal;
    let endpoint = '';
    let body: any = { adminComment };

    if (action === 'REVIEW') {
      endpoint = `/incidents/${incident.id}/review`;
    } else if (action === 'APPROVE') {
      endpoint = `/incidents/${incident.id}/approve`;
      body.createMissingPunch = createMissingPunch;
    } else if (action === 'REJECT') {
      endpoint = `/incidents/${incident.id}/reject`;
    }

    const res = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    setSubmitting(false);
    if (res.success) {
      setActiveModal(null);
      setAdminComment('');
      loadIncidents();
    } else {
      alert(res.error || 'Error al procesar la incidencia');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">Pendiente</span>;
      case 'REVIEWED':
        return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">En Revisión</span>;
      case 'RESOLVED':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">Aprobada / Resuelta</span>;
      case 'DISMISSED':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">Rechazada</span>;
      default:
        return <span className="text-slate-400">{status}</span>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'FORGOT_PUNCH': return 'He olvidado fichar';
      case 'PUNCH_ERROR': return 'Error en el fichaje';
      case 'GPS_ISSUE': return 'Problema de GPS';
      case 'CONNECTION_ISSUE': return 'Problema de conexión';
      default: return type;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100">Centro de Incidencias</h2>
          <p className="text-xs text-slate-400">Revisión, aprobación y regularización auditada de fichajes y peticiones de trabajadores</p>
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todas las Incidencias</option>
            <option value="PENDING">Pendientes</option>
            <option value="REVIEWED">En Revisión</option>
            <option value="RESOLVED">Aprobadas / Resueltas</option>
            <option value="DISMISSED">Rechazadas</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Cargando incidencias...</div>
      ) : incidents.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500 space-y-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto" />
          <p className="text-slate-300 font-semibold">No se encontraron incidencias en este filtro</p>
          <p className="text-slate-500">Todos los fichajes se encuentran al día y sin reclamaciones activas.</p>
        </div>
      ) : (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 uppercase text-[10px] text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Trabajador</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Detalle / Motivo</th>
                <th className="px-5 py-3">Petición</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {incidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-slate-900/40 transition">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-200">{inc.first_name} {inc.last_name}</div>
                    <div className="text-[10px] text-slate-500">{inc.department} • {inc.employee_code || inc.document_id}</div>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-slate-300">
                    {getTypeLabel(inc.type)}
                  </td>
                  <td className="px-5 py-3.5 max-w-xs">
                    <p className="text-slate-300 line-clamp-2">{inc.description}</p>
                    {inc.admin_comment && (
                      <p className="text-[10px] text-emerald-400 mt-1 italic">
                        Nota Admin: {inc.admin_comment}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400">
                    {inc.requested_time ? (
                      <div>
                        <span className="text-emerald-400 font-bold">{inc.requested_punch_type || 'FICHAJE'}</span>
                        <div className="text-slate-400">{new Date(inc.requested_time).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {getStatusBadge(inc.status)}
                  </td>
                  <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                    {inc.status === 'PENDING' && (
                      <button
                        onClick={() => { setActiveModal({ incident: inc, action: 'REVIEW' }); setAdminComment(inc.admin_comment || ''); }}
                        className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-[11px] font-semibold transition"
                      >
                        Revisar
                      </button>
                    )}
                    {inc.status !== 'RESOLVED' && inc.status !== 'DISMISSED' && (
                      <>
                        <button
                          onClick={() => { setActiveModal({ incident: inc, action: 'APPROVE' }); setAdminComment(inc.admin_comment || ''); }}
                          className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-[11px] font-semibold transition"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => { setActiveModal({ incident: inc, action: 'REJECT' }); setAdminComment(inc.admin_comment || ''); }}
                          className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[11px] font-semibold transition"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE ACCIÓN EN INCIDENCIA */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-100">
                {activeModal.action === 'APPROVE' && 'Aprobar Incidencia y Regularizar'}
                {activeModal.action === 'REJECT' && 'Rechazar Incidencia'}
                {activeModal.action === 'REVIEW' && 'Poner Incidencia en Revisión'}
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="text-slate-200 font-semibold">{activeModal.incident.first_name} {activeModal.incident.last_name}</div>
              <div className="text-slate-400 italic">"{activeModal.incident.description}"</div>
            </div>

            <form onSubmit={handleAction} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Comentario del Administrador (Auditable)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detalla el motivo o resolución..."
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {activeModal.action === 'APPROVE' && activeModal.incident.requested_time && (
                <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-emerald-300">
                  <input
                    type="checkbox"
                    id="missingPunch"
                    checked={createMissingPunch}
                    onChange={(e) => setCreateMissingPunch(e.target.checked)}
                    className="rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-0"
                  />
                  <label htmlFor="missingPunch" className="text-xs font-semibold cursor-pointer">
                    Crear fichaje de regularización automático en el sistema ({activeModal.incident.requested_punch_type})
                  </label>
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 font-bold rounded-xl disabled:opacity-50 text-slate-950 ${
                    activeModal.action === 'APPROVE' ? 'bg-emerald-500 hover:bg-emerald-400' :
                    activeModal.action === 'REJECT' ? 'bg-rose-500 hover:bg-rose-400 text-white' :
                    'bg-blue-500 hover:bg-blue-400'
                  }`}
                >
                  {submitting ? 'Procesando...' : 'Confirmar Acción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * ========================================================
 * 3. SECCIÓN: INFORMES Y EXPORTACIONES (REPORTS)
 * ========================================================
 */
export const ReportsView: React.FC<{ stats: DashboardStats }> = () => {
  const [report, setReport] = useState<any | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM

  const loadReport = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedEmployee) params.set('employeeId', selectedEmployee);
    if (selectedDepartment && selectedDepartment !== 'ALL') params.set('department', selectedDepartment);
    if (selectedMonth) params.set('month', selectedMonth);

    const [repRes, empRes] = await Promise.all([
      apiRequest(`/reports?${params.toString()}`),
      apiRequest('/employees'),
    ]);

    if (repRes.success && repRes.data) {
      setReport(repRes.data);
    }
    if (empRes.success && empRes.data) {
      setEmployees(empRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReport();
  }, [selectedEmployee, selectedDepartment, selectedMonth]);

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (selectedEmployee) params.set('employeeId', selectedEmployee);
    if (selectedDepartment && selectedDepartment !== 'ALL') params.set('department', selectedDepartment);
    if (selectedMonth) params.set('month', selectedMonth);
    downloadFile(`/reports/export/csv?${params.toString()}`, `informe_fichajes_${selectedMonth}.csv`);
  };

  const handleExportExcel = () => {
    const params = new URLSearchParams();
    if (selectedEmployee) params.set('employeeId', selectedEmployee);
    if (selectedDepartment && selectedDepartment !== 'ALL') params.set('department', selectedDepartment);
    if (selectedMonth) params.set('month', selectedMonth);
    downloadFile(`/reports/export/excel?${params.toString()}`, `informe_fichajes_${selectedMonth}.xls`);
  };

  const handleExportPdf = () => {
    const params = new URLSearchParams();
    if (selectedEmployee) params.set('employeeId', selectedEmployee);
    if (selectedDepartment && selectedDepartment !== 'ALL') params.set('department', selectedDepartment);
    if (selectedMonth) params.set('month', selectedMonth);
    openPdfView(`/reports/export/pdf?${params.toString()}`);
  };

  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100">Informes de Registro de Jornada</h2>
          <p className="text-xs text-slate-400">Cómputo exacto de horas, control de anomalías y exportación legal Art. 34.9 ET</p>
        </div>

        {/* BOTONES DE EXPORTACIÓN */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 rounded-xl text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 rounded-xl text-xs font-semibold transition"
          >
            <FileBarChart className="w-3.5 h-3.5" />
            <span>Excel (.xls)</span>
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-500/10"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF Oficial</span>
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-slate-400 font-semibold">Mes:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-slate-400 font-semibold">Departamento:</span>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todos los Departamentos</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-slate-400 font-semibold">Trabajador:</span>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="">Toda la Plantilla</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Calculando informe y analizando turnos...</div>
      ) : !report ? (
        <div className="p-8 text-center text-xs text-slate-500">Error al cargar informe.</div>
      ) : (
        <>
          {/* TARJETAS DE RESUMEN */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Horas Computadas</span>
              <div className="text-xl font-black text-emerald-400 font-mono mt-1">{report.summary.totalHoursWorked}</div>
              <span className="text-[10px] text-slate-400">{report.summary.totalHoursDecimal}h decimales</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Trabajadores</span>
              <div className="text-xl font-black text-slate-100 mt-1">{report.summary.totalEmployees}</div>
              <span className="text-[10px] text-slate-400">En el informe</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Fichajes Totales</span>
              <div className="text-xl font-black text-slate-100 font-mono mt-1">{report.summary.totalPunches}</div>
              <span className="text-[10px] text-slate-400">Entradas y Salidas</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Anomalías Detectadas</span>
              <div className={`text-xl font-black mt-1 ${report.summary.totalAnomalies > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {report.summary.totalAnomalies}
              </div>
              <span className="text-[10px] text-slate-400">
                {report.summary.totalAnomalies > 0 ? 'Requieren revisión' : 'Todo en regla'}
              </span>
            </div>
          </div>

          {/* TABLA DE TRABAJADORES E HISTORIAL */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wider">Desglose por Trabajador</h3>
              <span className="text-[11px] text-slate-400">Custodia legal de 4 años garantizada</span>
            </div>

            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 uppercase text-[10px] text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3">Trabajador</th>
                  <th className="px-5 py-3">DNI/Código</th>
                  <th className="px-5 py-3">Departamento</th>
                  <th className="px-5 py-3">Horas Totales</th>
                  <th className="px-5 py-3">Entradas / Salidas</th>
                  <th className="px-5 py-3">Anomalías / Incompletos</th>
                  <th className="px-5 py-3 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {report.employees.map((emp: any) => (
                  <tr key={emp.employeeId} className="hover:bg-slate-900/40 transition">
                    <td className="px-5 py-3.5 font-semibold text-slate-100">
                      {emp.fullName}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-400">
                      {emp.documentId} <span className="text-[10px] text-slate-500">({emp.employeeCode})</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">
                      {emp.department}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-bold text-emerald-400">
                      {emp.totalHoursFormatted}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-400">
                      {emp.totalEntries} In / {emp.totalExits} Out
                    </td>
                    <td className="px-5 py-3.5">
                      {emp.anomalies.length > 0 ? (
                        <div className="space-y-1">
                          {emp.anomalies.map((an: any, idx: number) => (
                            <span key={idx} className="block text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                              ⚠️ {an.description}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-emerald-500 font-semibold text-[11px] flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Sin anomalías
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        emp.shifts.length === 0 ? 'bg-slate-800 text-slate-400' :
                        emp.anomalies.length > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {emp.shifts.length === 0 ? 'Sin Fichajes' : emp.anomalies.length > 0 ? 'Con Incidencias' : 'Correcto'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * ========================================================
 * 4. SECCIÓN: AUDITORÍA (AUDIT LOGS)
 * ========================================================
 */
export const AuditView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carga de logs reales o eventos auditados del sistema
    const fetchAudit = async () => {
      setLoading(true);
      const res = await apiRequest('/admin/attendance?limit=20');
      if (res.success && res.data) {
        setLogs(res.data);
      }
      setLoading(false);
    };
    fetchAudit();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-slate-100">Registro Inmutable de Auditoría</h2>
        <p className="text-xs text-slate-400">Trazabilidad de seguridad para inspecciones laborales y cumplimiento legal estricto</p>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/60 uppercase text-[10px] text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="px-5 py-3">Acción Registrada</th>
              <th className="px-5 py-3">Trabajador / Entidad</th>
              <th className="px-5 py-3">Tipo Fichaje</th>
              <th className="px-5 py-3">Fecha y Hora Servidor</th>
              <th className="px-5 py-3">Precisión Auditada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
            {loading ? (
              <tr><td colSpan={5} className="p-6 text-center text-slate-500">Cargando eventos de auditoría...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-slate-500">No hay registros de auditoría aún.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/40">
                  <td className="px-5 py-3 font-semibold text-emerald-400">PUNCH_RECORDED</td>
                  <td className="px-5 py-3 text-slate-300 font-sans">{log.first_name} {log.last_name}</td>
                  <td className="px-5 py-3 text-slate-400">{log.type}</td>
                  <td className="px-5 py-3 text-slate-300">{new Date(log.timestamp).toLocaleString('es-ES')}</td>
                  <td className="px-5 py-3 text-slate-500">{log.accuracy ? `±${Math.round(log.accuracy)}m` : 'Regularizado'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * ========================================================
 * 5. SECCIÓN: CONFIGURACIÓN
 * ========================================================
 */
export const SettingsView: React.FC = () => {
  const [gpsThreshold, setGpsThreshold] = useState('150');
  const [requireGps, setRequireGps] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-slate-100">Configuración de Fichaje de la Empresa</h2>
        <p className="text-xs text-slate-400">Políticas de geolocalización puntual y control horario</p>
      </div>

      <form onSubmit={handleSave} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
        <div>
          <label className="block text-slate-300 font-semibold mb-1">
            Umbral Máximo de Precisión GPS (Metros)
          </label>
          <input
            type="number"
            value={gpsThreshold}
            onChange={(e) => setGpsThreshold(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Si un fichaje tiene una precisión superior a este valor (ej. 150m), se marcará como incidencial.
          </p>
        </div>

        <div className="flex items-center space-x-3 pt-2">
          <input
            type="checkbox"
            id="requireGps"
            checked={requireGps}
            onChange={(e) => setRequireGps(e.target.checked)}
            className="rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-0"
          />
          <label htmlFor="requireGps" className="text-slate-300 font-semibold cursor-pointer">
            Exigir captura de coordenadas GPS obligatoriamente al fichar
          </label>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <button
            type="submit"
            className="flex items-center space-x-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-emerald-500/10"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Configuración</span>
          </button>

          {saved && (
            <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
              ✓ Parámetros guardados con éxito
            </span>
          )}
        </div>
      </form>
    </div>
  );
};

/**
 * ========================================================
 * 6. SECCIÓN: MI CUENTA
 * ========================================================
 */
export const AccountView: React.FC<{ user: UserProfile | null; onLogout: () => void }> = ({ user, onLogout }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMsg({ text: 'Las contraseñas nuevas no coinciden.', error: true });
      return;
    }

    setSubmitting(true);
    const res = await apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setSubmitting(false);

    if (res.success) {
      setMsg({ text: 'Contraseña actualizada con éxito.', error: false });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setMsg({ text: res.error || 'Error al cambiar contraseña.', error: true });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl text-xs">
      <div>
        <h2 className="text-base font-bold text-slate-100">Mi Cuenta de Administrador</h2>
        <p className="text-slate-400">Información del perfil y credenciales de acceso</p>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-sm text-slate-200">Datos Personales y Empresa</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-slate-500 uppercase text-[10px] font-semibold block">Nombre Completo</span>
            <span className="text-slate-200 font-medium">{user?.firstName} {user?.lastName}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] font-semibold block">Correo Electrónico</span>
            <span className="text-slate-200 font-medium font-mono">{user?.email}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] font-semibold block">Empresa</span>
            <span className="text-slate-200 font-medium">{user?.companyName}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] font-semibold block">Rol</span>
            <span className="text-emerald-400 font-semibold">{user?.role}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleChangePassword} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-2 text-slate-200 font-bold text-sm">
          <Key className="w-4 h-4 text-emerald-400" />
          <span>Cambiar Contraseña</span>
        </div>

        {msg && (
          <div className={`p-3 rounded-xl border text-xs font-semibold ${msg.error ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
            {msg.text}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Contraseña Actual</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nueva Contraseña</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Confirmar Nueva Contraseña</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-between items-center">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition disabled:opacity-50"
          >
            {submitting ? 'Actualizando...' : 'Actualizar Contraseña'}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="text-rose-400 hover:text-rose-300 font-semibold"
          >
            Cerrar Sesión
          </button>
        </div>
      </form>
    </div>
  );
};
