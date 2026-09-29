import React, { useState } from 'react';
import { 
  Calendar, 
  FileBarChart, 
  CheckCircle2, 
  Clock, 
  Download, 
  Key, 
  Save
} from 'lucide-react';
import { UserProfile, DashboardStats } from '../types';
import { apiRequest } from '../api/client';

/**
 * 1. Sección: Horarios
 */
export const SchedulesView: React.FC = () => {
  const scheduleTemplates = [
    { id: '1', name: 'Jornada Continua General', hours: '08:00 - 16:30', days: 'Lunes a Viernes', dept: 'Administración y Operaciones', employees: 1 },
    { id: '2', name: 'Turno Mañana', hours: '06:00 - 14:00', days: 'Lunes a Sábado', dept: 'Logística y Almacén', employees: 0 },
    { id: '3', name: 'Turno Tarde', hours: '14:00 - 22:00', days: 'Lunes a Sábado', dept: 'Distribución', employees: 0 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-100">Horarios y Turnos Laborales</h2>
          <p className="text-xs text-slate-400">Plantillas de jornada laboral aplicadas a los trabajadores de la empresa</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scheduleTemplates.map((s) => (
          <div key={s.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Calendar className="w-4 h-4" />
              </span>
              <span className="text-[11px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400">
                {s.dept}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-200">{s.name}</h3>
              <p className="text-xl font-extrabold text-emerald-400 font-mono mt-1">{s.hours}</p>
              <p className="text-xs text-slate-400 mt-1">{s.days}</p>
            </div>
            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex justify-between">
              <span>Trabajadores asignados:</span>
              <strong className="text-slate-300">{s.employees}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 2. Sección: Informes
 */
export const ReportsView: React.FC<{ stats: DashboardStats }> = ({ stats }) => {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-slate-100">Informes de Registro de Jornada</h2>
        <p className="text-xs text-slate-400">Generación y exportación reglamentaria conforme al Estatuto de los Trabajadores</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center space-x-3 text-emerald-400">
            <FileBarChart className="w-5 h-5" />
            <h3 className="font-bold text-sm text-slate-200">Informe Mensual de Fichajes</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Consolidado mensual con detalle de entradas, salidas, horas ordinarias y geolocalización puntual.
          </p>
          <button 
            onClick={() => alert('Generando informe reglamentario mensual... Descarga iniciada.')}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 rounded-xl text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Informe Oficial (PDF/CSV)</span>
          </button>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center space-x-3 text-teal-400">
            <Clock className="w-5 h-5" />
            <h3 className="font-bold text-sm text-slate-200">Resumen de Horas Hoy</h3>
          </div>
          <p className="text-xs text-slate-400">
            Horas efectivas totales calculadas hoy en la empresa: <strong className="text-emerald-400 font-mono text-sm">{stats.todayHoursWorked} horas</strong>
          </p>
          <div className="text-[11px] text-slate-500 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/60">
            ✓ Cumplimiento estricto de custodia documental durante 4 años según la legislación vigente.
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 3. Sección: Incidencias
 */
export const IncidentsView: React.FC = () => {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-slate-100">Centro de Incidencias</h2>
        <p className="text-xs text-slate-400">Detección automática de anomalías en geolocalización o fichajes manuales</p>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-500 space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <p className="text-slate-200 font-bold text-sm">No existen incidencias pendientes</p>
        <p className="text-slate-400 max-w-md mx-auto">
          Todos los fichajes recientes cumplen con el umbral reglamentario de precisión GPS configurado (&lt; 150m).
        </p>
      </div>
    </div>
  );
};

/**
 * 4. Sección: Auditoría
 */
export const AuditView: React.FC = () => {
  const auditLogs = [
    { id: '1', action: 'USER_LOGIN', user: 'admin@techlogistics.es', entity: 'users', date: new Date().toLocaleTimeString('es-ES'), ip: '127.0.0.1' },
    { id: '2', action: 'PUNCH_CHECK_IN', user: 'carlos.garcia@techlogistics.es', entity: 'attendance_records', date: new Date(Date.now() - 3600000).toLocaleTimeString('es-ES'), ip: '127.0.0.1' },
    { id: '3', action: 'EMPLOYEE_CREATED', user: 'admin@techlogistics.es', entity: 'employees', date: new Date(Date.now() - 7200000).toLocaleTimeString('es-ES'), ip: '127.0.0.1' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-slate-100">Registro Inmutable de Auditoría</h2>
        <p className="text-xs text-slate-400">Trazabilidad de seguridad para inspecciones laborales y auditorías técnicas</p>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/60 uppercase text-[10px] text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="px-5 py-3">Evento</th>
              <th className="px-5 py-3">Usuario</th>
              <th className="px-5 py-3">Entidad</th>
              <th className="px-5 py-3">Hora</th>
              <th className="px-5 py-3">Dirección IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
            {auditLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-900/40">
                <td className="px-5 py-3 font-semibold text-emerald-400">{log.action}</td>
                <td className="px-5 py-3 text-slate-300 font-sans">{log.user}</td>
                <td className="px-5 py-3 text-slate-400">{log.entity}</td>
                <td className="px-5 py-3 text-slate-300">{log.date}</td>
                <td className="px-5 py-3 text-slate-500">{log.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * 5. Sección: Configuración
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
 * 6. Sección: Mi Cuenta
 */
export const AccountView: React.FC<{ user: UserProfile | null; onLogout: () => void }> = ({ user, onLogout }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    const res = await apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.success) {
      setStatusMsg({ text: 'Contraseña actualizada correctamente.', error: false });
      setCurrentPassword('');
      setNewPassword('');
    } else {
      setStatusMsg({ text: res.error || 'Error al cambiar contraseña', error: true });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-slate-100">Mi Perfil de Administrador</h2>
        <p className="text-xs text-slate-400">Información personal y seguridad de la cuenta</p>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-2xl font-bold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">{user?.firstName} {user?.lastName}</h3>
            <p className="text-slate-400 text-xs">{user?.email}</p>
            <span className="inline-block mt-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
              ROL: {user?.role}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800">
          <div>
            <span className="text-slate-500 block">Empresa Vinculada</span>
            <strong className="text-slate-200">{user?.companyName}</strong>
          </div>
          <div>
            <span className="text-slate-500 block">Teléfono</span>
            <strong className="text-slate-200">{user?.phone || 'No registrado'}</strong>
          </div>
        </div>
      </div>

      {/* Formulario de Cambio de Contraseña */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Key className="w-4 h-4 text-emerald-400" />
          <span>Cambiar Contraseña</span>
        </h3>

        {statusMsg && (
          <div className={`p-3 rounded-xl text-xs font-semibold ${
            statusMsg.error ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300' : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
          }`}>
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Contraseña Actual</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Nueva Contraseña (mínimo 8 caracteres, números y mayúsculas)</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-emerald-500/10"
            >
              {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
            >
              Cerrar Sesión Activa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
