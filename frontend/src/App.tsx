import { useState, useEffect } from 'react';
import { 
  Clock, 
  MapPin, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  Building2, 
  Activity, 
  ExternalLink, 
  RefreshCw,
  LogOut,
  LogIn
} from 'lucide-react';

interface AttendanceItem {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  timestamp: string;
  status: string;
  notes?: string;
  first_name: string;
  last_name: string;
  document_id: string;
  employee_code?: string;
  department?: string;
  company_name: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  location_captured_at?: string;
}

interface HealthData {
  status: string;
  timestamp: string;
  services: {
    database: {
      status: string;
      latencyMs?: number;
    };
    server: {
      uptimeSeconds: number;
      environment: string;
      version: string;
    };
  };
}

export default function App() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [records] = useState<AttendanceItem[]>([
    {
      id: 'demo-1',
      type: 'CHECK_IN',
      timestamp: new Date().toISOString(),
      status: 'VERIFIED',
      first_name: 'Carlos',
      last_name: 'García Moreno',
      document_id: '48765432X',
      employee_code: 'EMP-0042',
      department: 'Operaciones',
      company_name: 'Tech Logistics Iberia S.L.',
      latitude: 40.4530541,
      longitude: -3.6883445,
      accuracy: 8.5,
      location_captured_at: new Date().toISOString()
    }
  ]);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (err) {
      console.warn('Backend currently unreachable from web proxy, retry scheduled.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              FITXAI
            </h1>
            <p className="text-xs text-slate-400">Sistema Profesional de Fichaje y Control Horario</p>
          </div>
        </div>

        {/* Backend & DB Health Badge */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-full text-xs font-medium">
            <span className={`w-2 h-2 rounded-full ${health?.services?.database?.status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            <span className="text-slate-300">
              PostgreSQL: {health?.services?.database?.status === 'connected' ? `Conectado (${health.services.database.latencyMs}ms)` : 'Comprobando...'}
            </span>
          </div>

          <button 
            onClick={checkHealth}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
            title="Recargar estado"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Privacy / GPS Rule Notice */}
        <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-2xl p-4 flex items-start space-x-3.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-200/90 leading-relaxed">
            <strong className="text-emerald-300 font-semibold">Política de Fichaje y Geolocalización Puntual:</strong>
            {' '}El sistema solo activa el sensor GPS en el instante exacto en el que el empleado presiona el botón de fichar.
            Una vez registrada la posición y la hora exacta, el sensor se desactiva inmediatamente. 
            No existe seguimiento en segundo plano, rutas ni monitorización continua durante la jornada laboral.
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex items-center space-x-4">
            <div className="bg-blue-500/10 text-blue-400 p-3 rounded-xl border border-blue-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Trabajadores Activos</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-100">1</h3>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex items-center space-x-4">
            <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-xl border border-emerald-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Fichajes Hoy</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-100">{records.length}</h3>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex items-center space-x-4">
            <div className="bg-amber-500/10 text-amber-400 p-3 rounded-xl border border-amber-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Incidentes Pendientes</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-100">0</h3>
            </div>
          </div>
        </div>

        {/* Attendance Records Table */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Registros de Asistencia y Fichaje</h2>
              <p className="text-xs text-slate-400 mt-0.5">Control de entradas y salidas con verificación GPS puntual</p>
            </div>
            <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-medium">
              Panel Administrador / Jefe
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs uppercase text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Trabajador</th>
                  <th className="px-6 py-4">Empresa</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Fecha y Hora Exacta</th>
                  <th className="px-6 py-4">Ubicación GPS Puntual</th>
                  <th className="px-6 py-4">Precisión</th>
                  <th className="px-6 py-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/40 transition">
                    <td className="px-6 py-4 font-medium text-slate-200">
                      <div>{r.first_name} {r.last_name}</div>
                      <div className="text-xs text-slate-500">{r.document_id} · {r.employee_code}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>{r.company_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {r.type === 'CHECK_IN' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <LogIn className="w-3.5 h-3.5" />
                          <span>ENTRADA</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          <LogOut className="w-3.5 h-3.5" />
                          <span>SALIDA</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-300">
                      {new Date(r.timestamp).toLocaleString('es-ES', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">
                      {r.latitude && r.longitude ? (
                        <a 
                          href={`https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=17/${r.latitude}/${r.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 underline"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>
                      ) : (
                        <span className="text-slate-500">Sin coordenadas</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                        ±{r.accuracy ? r.accuracy.toFixed(1) : 0} m
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center space-x-1 text-xs text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verificado</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500">
        FITXAI v1.0.0 · Arquitectura Profesional Monorepo · Base de datos PostgreSQL 16
      </footer>
    </div>
  );
}
