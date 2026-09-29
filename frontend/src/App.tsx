import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { EmployeesView } from './components/EmployeesView';
import { AttendanceView } from './components/AttendanceView';
import { MapView } from './components/MapView';
import { EmployeeDetailModal } from './components/EmployeeDetailModal';
import { 
  SchedulesView, 
  ReportsView, 
  IncidentsView, 
  AuditView, 
  SettingsView, 
  AccountView 
} from './components/OtherViews';
import { LoginView } from './components/LoginView';
import { PunchDetailModal } from './components/PunchDetailModal';
import { 
  RealtimeNotificationToast, 
  PunchNotificationData 
} from './components/RealtimeNotificationToast';
import { 
  realtimeManager, 
  RealtimeConnectionStatus, 
  RealtimePunchEvent 
} from './api/realtime';
import { 
  SidebarSection, 
  UserProfile, 
  DashboardStats, 
  EmployeeItem, 
  AttendanceRecordItem 
} from './types';
import { apiRequest, getStoredToken, clearStoredToken } from './api/client';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeSection, setActiveSection] = useState<SidebarSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Estados de datos
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    todayPunches: 0,
    todayCheckIns: 0,
    todayCheckOuts: 0,
    todayHoursWorked: 0,
    pendingIncidents: 0,
  });

  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecordItem[]>([]);
  const [selectedRecordForMap, setSelectedRecordForMap] = useState<AttendanceRecordItem | null>(null);
  const [selectedEmployeeForDetail, setSelectedEmployeeForDetail] = useState<EmployeeItem | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [dbLatency, setDbLatency] = useState<number>(1);

  // Estados de Tiempo Real (SSE) y Notificaciones en Vivo
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>('disconnected');
  const [liveNotifications, setLiveNotifications] = useState<PunchNotificationData[]>([]);
  const [inspectingPunch, setInspectingPunch] = useState<AttendanceRecordItem | null>(null);

  // 1. Cargar Salud del Sistema (DB Connection)
  const checkHealth = useCallback(async () => {
    try {
      const res = await apiRequest('/health');
      if (res && res.services?.database) {
        setDbStatus(res.services.database.status === 'connected' ? 'connected' : 'error');
        setDbLatency(res.services.database.latencyMs || 1);
      }
    } catch {
      setDbStatus('error');
    }
  }, []);

  // 2. Cargar Datos del Usuario Autenticado
  const loadUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setCheckingAuth(false);
      return;
    }

    const res = await apiRequest('/users/me');
    if (res.success && res.data) {
      setUser({
        id: res.data.id,
        email: res.data.email,
        firstName: res.data.firstName,
        lastName: res.data.lastName,
        phone: res.data.phone,
        role: res.data.role,
        companyId: res.data.company.id,
        companyName: res.data.company.name,
      });
    } else {
      clearStoredToken();
      setUser(null);
    }
    setCheckingAuth(false);
  }, []);

  // 3. Cargar Datos de Negocio (Stats, Empleados, Fichajes)
  const loadBusinessData = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      // Stats
      apiRequest('/admin/stats').then((res) => {
        if (res.success && res.data) {
          setStats(res.data);
        }
      }),
      // Empleados
      apiRequest('/employees').then((res) => {
        if (res.success && res.data) {
          setEmployees(res.data);
        }
      }),
      // Fichajes
      apiRequest('/admin/attendance?limit=100').then((res) => {
        if (res.success && res.data) {
          setAttendance(res.data);
        }
      }),
      checkHealth(),
    ]);
    setIsRefreshing(false);
  }, [checkHealth]);

  // Inicialización
  useEffect(() => {
    loadUser();
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [loadUser, checkHealth]);

  useEffect(() => {
    if (user) {
      loadBusinessData();
    }
  }, [user, loadBusinessData]);

  // 4. Conexión y suscripción a eventos en tiempo real (SSE)
  useEffect(() => {
    if (!user) {
      realtimeManager.disconnect();
      return;
    }

    // Iniciar conexión al canal SSE
    realtimeManager.connect();

    // Suscripción al estado de la conexión
    const unsubStatus = realtimeManager.subscribeStatus((newStatus) => {
      setRealtimeStatus(newStatus);
      // Si se reconecta tras un corte de red, sincronizar datos con el servidor
      if (newStatus === 'connected') {
        loadBusinessData();
      }
    });

    // Suscripción al evento NEW_PUNCH emitido por el backend
    const unsubPunch = realtimeManager.subscribePunch((event: RealtimePunchEvent) => {
      console.log('[APP] Evento NEW_PUNCH recibido en vivo:', event.record.id);

      // 1. Insertar el nuevo fichaje en la tabla sin recargar la página
      setAttendance((prev) => [
        event.record,
        ...prev.filter((p) => p.id !== event.record.id),
      ]);

      // 2. Actualizar contadores del dashboard en vivo
      setStats((prev) => {
        const isCheckIn = event.record.type === 'CHECK_IN';
        return {
          ...prev,
          todayPunches: prev.todayPunches + 1,
          todayCheckIns: isCheckIn ? prev.todayCheckIns + 1 : prev.todayCheckIns,
          todayCheckOuts: !isCheckIn ? prev.todayCheckOuts + 1 : prev.todayCheckOuts,
        };
      });

      // 3. Sincronizar estadísticas consolidadas en segundo plano
      apiRequest('/admin/stats').then((res) => {
        if (res.success && res.data) {
          setStats(res.data);
        }
      });

      // 4. Mostrar notificación visual flotante
      const newNotif: PunchNotificationData = {
        id: event.eventId,
        title: event.notification.title,
        workerName: event.notification.workerName,
        punchType: event.notification.punchType,
        time: event.notification.time,
        locationStatus: event.notification.locationStatus,
        record: event.record,
      };

      setLiveNotifications((prev) => [newNotif, ...prev.slice(0, 3)]);
    });

    return () => {
      unsubStatus();
      unsubPunch();
      realtimeManager.disconnect();
    };
  }, [user, loadBusinessData]);

  // Manejador de Logout
  const handleLogout = async () => {
    realtimeManager.disconnect();
    await apiRequest('/auth/logout', { method: 'POST' });
    clearStoredToken();
    setUser(null);
    setActiveSection('dashboard');
  };

  // Navegación hacia mapa enfocando un fichaje
  const handleViewLocation = (record: AttendanceRecordItem) => {
    setSelectedRecordForMap(record);
    setActiveSection('map');
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Si no está autenticado, renderizamos pantalla de login
  if (!user) {
    return <LoginView onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col lg:flex-row antialiased">
      {/* Barra Lateral Profesional (10 items) */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        user={user}
        onLogout={handleLogout}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Área Principal de Contenido */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Cabecera Superior */}
        <Header
          activeSection={activeSection}
          onOpenMobile={() => setMobileMenuOpen(true)}
          onRefresh={loadBusinessData}
          isRefreshing={isRefreshing}
          dbStatus={dbStatus}
          latencyMs={dbLatency}
          realtimeStatus={realtimeStatus}
          onReconnectRealtime={() => realtimeManager.reconnect()}
        />

        {/* Contenedor de Vista Dinámica */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeSection === 'dashboard' && (
            <DashboardView
              stats={stats}
              recentAttendance={attendance}
              onViewLocation={handleViewLocation}
              onNavigateToAttendance={() => setActiveSection('attendance')}
              onNavigateToEmployees={() => setActiveSection('employees')}
            />
          )}

          {activeSection === 'employees' && (
            <EmployeesView
              employees={employees}
              onRefresh={loadBusinessData}
              onOpenDetail={(emp) => setSelectedEmployeeForDetail(emp)}
            />
          )}

          {activeSection === 'attendance' && (
            <AttendanceView
              records={attendance}
              employees={employees}
              onRefresh={loadBusinessData}
              onViewLocation={handleViewLocation}
            />
          )}

          {activeSection === 'map' && (
            <MapView
              records={attendance}
              selectedRecordFromProps={selectedRecordForMap}
            />
          )}

          {activeSection === 'schedules' && <SchedulesView />}
          {activeSection === 'reports' && <ReportsView stats={stats} />}
          {activeSection === 'incidents' && <IncidentsView />}
          {activeSection === 'audit' && <AuditView />}
          {activeSection === 'settings' && <SettingsView />}
          {activeSection === 'account' && (
            <AccountView user={user} onLogout={handleLogout} />
          )}
        </main>
      </div>

      {/* Modal: Ficha del Trabajador */}
      {selectedEmployeeForDetail && (
        <EmployeeDetailModal
          employee={selectedEmployeeForDetail}
          onClose={() => setSelectedEmployeeForDetail(null)}
          onEdit={() => {
            setSelectedEmployeeForDetail(null);
            setActiveSection('employees');
          }}
        />
      )}

      {/* Notificaciones Flotantes de Fichajes en Vivo */}
      <RealtimeNotificationToast
        notifications={liveNotifications}
        onDismiss={(id) => setLiveNotifications((prev) => prev.filter((n) => n.id !== id))}
        onInspect={(record) => setInspectingPunch(record)}
      />

      {/* Modal: Detalle de Fichaje Inspeccionado en Tiempo Real */}
      {inspectingPunch && (
        <PunchDetailModal
          record={inspectingPunch}
          onClose={() => setInspectingPunch(null)}
        />
      )}
    </div>
  );
}
