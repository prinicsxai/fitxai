import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  MapPin, 
  Calendar, 
  AlertTriangle, 
  User, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  RotateCw, 
  Send, 
  X,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import { UserProfile, AttendanceRecordItem } from '../types';
import { apiRequest } from '../api/client';
import { getWebPunchPosition } from '../api/geolocation';

interface WorkerViewProps {
  user: UserProfile;
  onLogout: () => void;
  onSwitchToAdmin?: () => void;
}

type WorkerTab = 'punch' | 'history' | 'hours' | 'incidents' | 'profile';

interface ShiftStatus {
  status: 'NOT_STARTED' | 'ACTIVE' | 'FINISHED';
  statusText: string;
  actionButton: string | null;
  nextType: 'CHECK_IN' | 'CHECK_OUT';
  checkInTime: string | null;
  checkOutTime: string | null;
  hoursWorked: string | null;
  punchesCount: number;
}

interface WorkerIncident {
  id: string;
  type: string;
  severity: string;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  admin_comment?: string;
  created_at: string;
}

export const WorkerView: React.FC<WorkerViewProps> = ({ user, onLogout, onSwitchToAdmin }) => {
  const [activeTab, setActiveTab] = useState<WorkerTab>('punch');
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus>({
    status: 'NOT_STARTED',
    statusText: 'NO HAS FICHADO',
    actionButton: 'FICHAR ENTRADA',
    nextType: 'CHECK_IN',
    checkInTime: null,
    checkOutTime: null,
    hoursWorked: null,
    punchesCount: 0,
  });

  // Estado de fichaje en curso y GPS
  const [isPunching, setIsPunching] = useState(false);
  const [punchFeedback, setPunchFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    details?: string;
  } | null>(null);

  // Historial de fichajes propios
  const [myPunches, setMyPunches] = useState<AttendanceRecordItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Incidencias propias
  const [myIncidents, setMyIncidents] = useState<WorkerIncident[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [showNewIncidentModal, setShowNewIncidentModal] = useState(false);
  const [newIncidentType, setNewIncidentType] = useState('He olvidado fichar');
  const [newIncidentDesc, setNewIncidentDesc] = useState('');
  const [submittingIncident, setSubmittingIncident] = useState(false);

  // Modal para inspeccionar mapa de un fichaje propio
  const [mapPunch, setMapPunch] = useState<AttendanceRecordItem | null>(null);

  // Cargar estado de la jornada actual
  const loadStatus = useCallback(async () => {
    try {
      const res = await apiRequest('/attendance/my-status');
      if (res.success && res.data) {
        setShiftStatus(res.data);
      }
    } catch (err) {
      console.error('Error cargando estado:', err);
    }
  }, []);

  // Cargar historial de fichajes propios
  const loadMyPunches = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiRequest('/attendance/my-punches');
      if (res.success && res.data) {
        setMyPunches(res.data);
      }
    } catch (err) {
      console.error('Error cargando fichajes:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Cargar incidencias propias
  const loadMyIncidents = useCallback(async () => {
    setLoadingIncidents(true);
    try {
      const res = await apiRequest('/incidents/my-incidents');
      if (res.success && res.data) {
        setMyIncidents(res.data);
      }
    } catch (err) {
      console.error('Error cargando incidencias:', err);
    } finally {
      setLoadingIncidents(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'hours') {
      loadMyPunches();
    } else if (activeTab === 'incidents') {
      loadMyIncidents();
    }
  }, [activeTab, loadMyPunches, loadMyIncidents]);

  /**
   * FLUJO ESTRICTO DE FICHAJE CON GPS WEB
   * 1. Usuario pulsa "FICHAR ENTRADA" o "FICHAR SALIDA"
   * 2. Se invoca navigator.geolocation.getCurrentPosition()
   * 3. Se obtiene posición (lat, lon, precisión)
   * 4. Se envía de inmediato al backend
   * 5. El sensor GPS se libera de inmediato (no continuous tracking)
   */
  const handlePunch = async (punchTypeOverride?: 'CHECK_IN' | 'CHECK_OUT') => {
    const typeToPunch = punchTypeOverride || shiftStatus.nextType;
    setIsPunching(true);
    setPunchFeedback({
      type: 'info',
      message: 'Solicitando coordenadas GPS puntuales al navegador...',
    });

    try {
      // 1. Obtener posición GPS del navegador
      const geoResult = await getWebPunchPosition();
      if (!geoResult.success || !geoResult.coords) {
        setPunchFeedback({
          type: 'error',
          message: 'Error al capturar la ubicación GPS',
          details: geoResult.error || 'Asegúrate de permitir el acceso a la ubicación en tu navegador.',
        });
        setIsPunching(false);
        return;
      }

      setPunchFeedback({
        type: 'info',
        message: 'Registrando fichaje con el servidor central...',
      });

      // 2. Enviar petición al backend
      const res = await apiRequest('/attendance/punch', {
        method: 'POST',
        body: JSON.stringify({
          type: typeToPunch,
          latitude: geoResult.coords.latitude,
          longitude: geoResult.coords.longitude,
          accuracy: geoResult.coords.accuracy,
          altitude: geoResult.coords.altitude,
          deviceInfo: `Navegador Web (${navigator.userAgent.slice(0, 100)})`,
        }),
      });

      if (res.success) {
        setPunchFeedback({
          type: 'success',
          message: typeToPunch === 'CHECK_IN' ? '¡Entrada registrada correctamente!' : '¡Salida registrada correctamente!',
          details: `GPS puntual: ±${geoResult.coords.accuracy}m (${geoResult.coords.latitude.toFixed(5)}, ${geoResult.coords.longitude.toFixed(5)}). Sensor detenido.`,
        });
        await loadStatus();
        if (activeTab === 'history') {
          loadMyPunches();
        }
      } else {
        setPunchFeedback({
          type: 'error',
          message: 'No se pudo registrar el fichaje',
          details: res.error || 'Verifica tu conexión a Internet o contacta con el administrador.',
        });
      }
    } catch (err: any) {
      setPunchFeedback({
        type: 'error',
        message: 'Fallo de comunicación',
        details: err.message || 'Error inesperado.',
      });
    } finally {
      setIsPunching(false);
    }
  };

  // Enviar nueva incidencia
  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncidentDesc.trim()) return;

    setSubmittingIncident(true);
    try {
      const res = await apiRequest('/incidents', {
        method: 'POST',
        body: JSON.stringify({
          type: newIncidentType,
          description: newIncidentDesc,
          severity: 'MEDIUM',
        }),
      });

      if (res.success) {
        setShowNewIncidentModal(false);
        setNewIncidentDesc('');
        loadMyIncidents();
      } else {
        alert(res.error || 'Error al enviar incidencia');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setSubmittingIncident(false);
    }
  };

  // Cálculo de estadísticas de horas
  const calculateHoursSummary = () => {
    let todayMinutes = 0;
    let weekMinutes = 0;
    let monthMinutes = 0;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Agrupar fichajes por pares entrada-salida
    const sorted = [...myPunches].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let lastCheckInTime: Date | null = null;

    for (const p of sorted) {
      const pDate = new Date(p.timestamp);
      if (p.type === 'CHECK_IN') {
        lastCheckInTime = pDate;
      } else if (p.type === 'CHECK_OUT' && lastCheckInTime) {
        const diffMins = Math.max(0, Math.floor((pDate.getTime() - lastCheckInTime.getTime()) / 60000));
        
        // Sumar a hoy
        if (pDate.toDateString() === now.toDateString()) {
          todayMinutes += diffMins;
        }
        // Sumar a semana
        if (pDate >= startOfWeek) {
          weekMinutes += diffMins;
        }
        // Sumar a mes
        if (pDate >= startOfMonth) {
          monthMinutes += diffMins;
        }

        lastCheckInTime = null;
      }
    }

    const fmt = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${String(m).padStart(2, '0')}m`;
    };

    return {
      today: fmt(todayMinutes),
      week: fmt(weekMinutes),
      month: fmt(monthMinutes),
      todayMins: todayMinutes,
    };
  };

  const hoursSummary = calculateHoursSummary();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between pb-20 md:pb-6 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Header Mobile / Web */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white font-black text-sm flex items-center justify-center shadow-lg shadow-emerald-500/20">
              FX
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 leading-none">FITXAI Web</div>
              <div className="text-sm font-bold text-white leading-tight">Portal del Treballador</div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Si el usuario tiene rol administrativo, permitirle volver al panel */}
            {(user.role === 'ADMIN' || user.role === 'MANAGER') && onSwitchToAdmin && (
              <button
                onClick={onSwitchToAdmin}
                className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 text-emerald-400 hover:bg-slate-700 border border-emerald-500/30 rounded-lg flex items-center space-x-1"
                title="Volver a la vista del administrador"
              >
                <span>Panel Admin</span>
              </button>
            )}

            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800/80 hover:bg-slate-800 rounded-xl transition"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4">
        {/* ================================================================ */}
        {/* TAB 1: PUNCH / INICIO (PANTALLA PRINCIPAL)                        */}
        {/* ================================================================ */}
        {activeTab === 'punch' && (
          <div className="space-y-4">
            {/* Greeting */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-5 shadow-xl">
              <div className="text-xs uppercase tracking-wider font-semibold text-emerald-400 mb-1">
                {user.companyName}
              </div>
              <h2 className="text-2xl font-black text-white">
                Hola, {user.firstName}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* Shift Status Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-5">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Estado actual
                </span>
                
                {/* Badges de Estado */}
                {shiftStatus.status === 'NOT_STARTED' && (
                  <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-400 mr-2" />
                    NO HAS FICHADO
                  </div>
                )}

                {shiftStatus.status === 'ACTIVE' && (
                  <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-2" />
                    JORNADA ACTIVA
                  </div>
                )}

                {shiftStatus.status === 'FINISHED' && (
                  <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 mr-1.5 text-blue-400" />
                    JORNADA FINALIZADA
                  </div>
                )}
              </div>

              {/* Tiempos de Jornada */}
              {shiftStatus.status === 'ACTIVE' && (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-center space-x-3">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  <div className="text-left">
                    <div className="text-[11px] text-slate-400">Hora de inicio registrada:</div>
                    <div className="text-xl font-black text-white">Entrada: {shiftStatus.checkInTime}</div>
                  </div>
                </div>
              )}

              {shiftStatus.status === 'FINISHED' && (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-3 gap-2 divide-x divide-slate-800">
                  <div className="text-center">
                    <div className="text-[10px] text-slate-400">Entrada</div>
                    <div className="text-sm font-bold text-white">{shiftStatus.checkInTime}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-slate-400">Salida</div>
                    <div className="text-sm font-bold text-white">{shiftStatus.checkOutTime}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-slate-400">Horas</div>
                    <div className="text-sm font-black text-emerald-400">{shiftStatus.hoursWorked}</div>
                  </div>
                </div>
              )}

              {/* Botón Principal de Fichaje */}
              <div className="pt-2">
                {shiftStatus.status === 'NOT_STARTED' && (
                  <button
                    disabled={isPunching}
                    onClick={() => handlePunch('CHECK_IN')}
                    className="w-full py-5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:scale-[0.98] text-white font-black text-lg shadow-xl shadow-emerald-500/25 transition disabled:opacity-50 flex items-center justify-center space-x-3 cursor-pointer"
                  >
                    {isPunching ? (
                      <RotateCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-6 h-6" />
                        <span>FICHAR ENTRADA</span>
                      </>
                    )}
                  </button>
                )}

                {shiftStatus.status === 'ACTIVE' && (
                  <button
                    disabled={isPunching}
                    onClick={() => handlePunch('CHECK_OUT')}
                    className="w-full py-5 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 active:scale-[0.98] text-white font-black text-lg shadow-xl shadow-rose-500/25 transition disabled:opacity-50 flex items-center justify-center space-x-3 cursor-pointer"
                  >
                    {isPunching ? (
                      <RotateCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <LogOut className="w-6 h-6" />
                        <span>FICHAR SALIDA</span>
                      </>
                    )}
                  </button>
                )}

                {shiftStatus.status === 'FINISHED' && (
                  <button
                    disabled={isPunching}
                    onClick={() => handlePunch('CHECK_IN')}
                    className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 font-bold text-sm border border-slate-700 transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>Iniciar nuevo turno extra</span>
                  </button>
                )}
              </div>

              {/* Mensajes de Feedback y Alertas de GPS */}
              {punchFeedback && (
                <div
                  className={`p-3.5 rounded-2xl text-left border text-xs transition animate-fade-in ${
                    punchFeedback.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : punchFeedback.type === 'error'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                      : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
                  }`}
                >
                  <div className="flex items-start space-x-2.5">
                    {punchFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : punchFeedback.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    ) : (
                      <RotateCw className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 animate-spin" />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="font-bold">{punchFeedback.message}</div>
                      {punchFeedback.details && (
                        <div className="text-[11px] opacity-90 leading-relaxed">
                          {punchFeedback.details}
                        </div>
                      )}
                      {punchFeedback.type === 'error' && (
                        <button
                          onClick={() => handlePunch()}
                          className="mt-2 inline-flex items-center px-3 py-1 bg-rose-500 text-white font-semibold rounded-lg text-[11px] hover:bg-rose-600 transition"
                        >
                          <RotateCw className="w-3 h-3 mr-1" />
                          Reintentar fichaje
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Privacy Notice */}
              <div className="text-[11px] text-slate-500 flex items-center justify-center space-x-1.5 pt-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Geolocalización puntual. Sin seguimiento continuo.</span>
              </div>
            </div>

            {/* Quick access summary */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveTab('history')}
                className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-left hover:border-slate-700 transition"
              >
                <Calendar className="w-5 h-5 text-emerald-400 mb-2" />
                <div className="text-xs text-slate-400">Mis fichajes</div>
                <div className="text-sm font-bold text-white">Ver historial</div>
              </button>

              <button
                onClick={() => setActiveTab('incidents')}
                className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-left hover:border-slate-700 transition"
              >
                <AlertTriangle className="w-5 h-5 text-amber-400 mb-2" />
                <div className="text-xs text-slate-400">Incidencias</div>
                <div className="text-sm font-bold text-white">Notificar olvido</div>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 2: HISTORIAL (MIS FICHAJES PROPIOS)                            */}
        {/* ================================================================ */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Mis Fichajes</h3>
                <p className="text-xs text-slate-400">Solo tus registros propios y puntuales</p>
              </div>
              <button
                onClick={loadMyPunches}
                className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white"
              >
                <RotateCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-12 text-center text-slate-500 text-xs">Cargando fichajes...</div>
            ) : myPunches.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">No tienes fichajes registrados todavía.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myPunches.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between hover:border-slate-700 transition"
                  >
                    <div className="flex items-start space-x-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          item.type === 'CHECK_IN'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {item.type === 'CHECK_IN' ? 'ENT' : 'SAL'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          {item.type === 'CHECK_IN' ? 'Entrada' : 'Salida'} · {item.hora || new Date(item.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item.fecha || new Date(item.timestamp).toLocaleDateString('es-ES')}
                        </div>
                        {item.latitude && item.longitude && (
                          <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-emerald-400" />
                            <span>GPS: ±{item.accuracy ? Math.round(item.accuracy) : '?'}m</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {item.latitude && item.longitude && (
                      <button
                        onClick={() => setMapPunch(item)}
                        className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg flex items-center space-x-1 shrink-0"
                      >
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        <span>Ver punto</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 3: MIS HORAS (RESUMEN LABORAL)                                */}
        {/* ================================================================ */}
        {activeTab === 'hours' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">Mis Horas Trabajadas</h3>
              <p className="text-xs text-slate-400">Cómputo automático según tus fichajes</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Jornada de hoy</div>
                  <div className="text-2xl font-black text-emerald-400">{hoursSummary.today}</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Esta semana</div>
                  <div className="text-2xl font-black text-cyan-400">{hoursSummary.week}</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Este mes</div>
                  <div className="text-2xl font-black text-indigo-400">{hoursSummary.month}</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-400 space-y-1.5">
              <div className="font-semibold text-slate-200">Garantía Art. 34.9 Estatuto de los Trabajadores</div>
              <p className="text-[11px] leading-relaxed">
                Este registro se computa de forma inmutable mediante fecha y hora oficial del servidor. Puedes consultar tu histórico en cualquier momento o solicitar correcciones mediante incidencias.
              </p>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 4: INCIDENCIAS (NOTIFICAR OLVIDOS, ERRORES GPS)                */}
        {/* ================================================================ */}
        {activeTab === 'incidents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Incidencias</h3>
                <p className="text-xs text-slate-400">Notifica olvidos o incidencias con fichajes</p>
              </div>
              <button
                onClick={() => setShowNewIncidentModal(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1"
              >
                <span>Nueva</span>
              </button>
            </div>

            {loadingIncidents ? (
              <div className="py-12 text-center text-slate-500 text-xs">Cargando incidencias...</div>
            ) : myIncidents.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">No tienes incidencias pendientes ni notificadas.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">{inc.type}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(inc.created_at).toLocaleString('es-ES')}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          inc.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : inc.status === 'REJECTED'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {inc.status === 'APPROVED' ? 'Aprobada' : inc.status === 'REJECTED' ? 'Rechazada' : 'Pendiente'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
                      {inc.description}
                    </p>

                    {inc.admin_comment && (
                      <div className="text-[11px] text-cyan-300 bg-cyan-950/30 border border-cyan-800/40 p-2 rounded-xl">
                        <span className="font-semibold">Respuesta del Admin: </span>
                        {inc.admin_comment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 5: MI PERFIL                                                  */}
        {/* ================================================================ */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">Mi Perfil</h3>
              <p className="text-xs text-slate-400">Datos registrados en la empresa</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center space-x-3 pb-4 border-b border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white font-black text-lg flex items-center justify-center">
                  {user.firstName[0]}{user.lastName?.[0] || ''}
                </div>
                <div>
                  <div className="text-base font-bold text-white">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-xs text-emerald-400 font-medium">{user.role}</div>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Empresa</div>
                  <div className="font-medium text-slate-200">{user.companyName}</div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Correo Electrónico</div>
                  <div className="font-medium text-slate-200">{user.email}</div>
                </div>

                {user.phone && (
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Teléfono</div>
                    <div className="font-medium text-slate-200">{user.phone}</div>
                  </div>
                )}

                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Identificador de Usuario</div>
                  <div className="font-mono text-[10px] text-slate-400 break-all">{user.id}</div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={onLogout}
                  className="w-full py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center justify-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar sesión segura</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================================================================ */}
      {/* MOBILE BOTTOM NAVIGATION BAR                                      */}
      {/* ================================================================ */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 py-2">
        <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
          <button
            onClick={() => setActiveTab('punch')}
            className={`flex flex-col items-center py-1.5 px-1 rounded-xl text-[10px] font-semibold transition ${
              activeTab === 'punch' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-5 h-5 mb-0.5" />
            <span>Inicio</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center py-1.5 px-1 rounded-xl text-[10px] font-semibold transition ${
              activeTab === 'history' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span>Fichajes</span>
          </button>

          <button
            onClick={() => setActiveTab('hours')}
            className={`flex flex-col items-center py-1.5 px-1 rounded-xl text-[10px] font-semibold transition ${
              activeTab === 'hours' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-5 h-5 mb-0.5" />
            <span>Horas</span>
          </button>

          <button
            onClick={() => setActiveTab('incidents')}
            className={`flex flex-col items-center py-1.5 px-1 rounded-xl text-[10px] font-semibold transition ${
              activeTab === 'incidents' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-5 h-5 mb-0.5" />
            <span>Incidencias</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center py-1.5 px-1 rounded-xl text-[10px] font-semibold transition ${
              activeTab === 'profile' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-5 h-5 mb-0.5" />
            <span>Perfil</span>
          </button>
        </div>
      </nav>

      {/* ================================================================ */}
      {/* MODAL: NUEVA INCIDENCIA                                           */}
      {/* ================================================================ */}
      {showNewIncidentModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-white">Notificar Incidencia</h4>
              <button
                onClick={() => setShowNewIncidentModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitIncident} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Motivo</label>
                <select
                  value={newIncidentType}
                  onChange={(e) => setNewIncidentType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="He olvidado fichar">He olvidado fichar</option>
                  <option value="Error en el fichaje">Error en el fichaje</option>
                  <option value="Problema con GPS">Problema con GPS</option>
                  <option value="Problema de conexión">Problema de conexión</option>
                  <option value="Otro">Otro motivo</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Explicación detallada</label>
                <textarea
                  required
                  rows={3}
                  value={newIncidentDesc}
                  onChange={(e) => setNewIncidentDesc(e.target.value)}
                  placeholder="Explica qué ha ocurrido, la hora real estimada..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewIncidentModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingIncident}
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center space-x-1"
                >
                  {submittingIncident ? (
                    <RotateCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MODAL: VER PUNTO GPS PUNTUAL EN MAPA                              */}
      {/* ================================================================ */}
      {mapPunch && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">Ubicación del Fichaje</h4>
                <div className="text-[11px] text-slate-400">
                  {mapPunch.type === 'CHECK_IN' ? 'Entrada' : 'Salida'} · {mapPunch.hora || new Date(mapPunch.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <button
                onClick={() => setMapPunch(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {mapPunch.latitude && mapPunch.longitude ? (
              <div className="space-y-3">
                <div className="w-full h-48 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 relative">
                  <iframe
                    title="Ubicación puntual"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapPunch.longitude - 0.003}%2C${mapPunch.latitude - 0.003}%2C${mapPunch.longitude + 0.003}%2C${mapPunch.latitude + 0.003}&layer=mapnik&marker=${mapPunch.latitude}%2C${mapPunch.longitude}`}
                  />
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Coordenadas:</span>
                    <span className="font-mono text-slate-200">{mapPunch.latitude.toFixed(5)}, {mapPunch.longitude.toFixed(5)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Precisión GPS:</span>
                    <span className="font-bold text-emerald-400">±{mapPunch.accuracy ? Math.round(mapPunch.accuracy) : '?'} metros</span>
                  </div>
                </div>

                <a
                  href={`https://www.google.com/maps?q=${mapPunch.latitude},${mapPunch.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir en Google Maps</span>
                </a>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 text-xs">
                No hay coordenadas GPS disponibles para este fichaje.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
