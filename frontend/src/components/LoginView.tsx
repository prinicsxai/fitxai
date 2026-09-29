import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { apiRequest, setStoredToken } from '../api/client';
import { UserProfile } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@techlogistics.es');
  const [password, setPassword] = useState('Admin1234!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, platform: 'web' }),
    });

    if (res.success && res.token && res.user) {
      setStoredToken(res.token);
      onLoginSuccess({
        id: res.user.id,
        email: res.user.email,
        firstName: res.user.firstName || 'Administrador',
        lastName: res.user.lastName || '',
        phone: res.user.phone,
        role: res.user.role,
        companyId: res.user.companyId,
        companyName: res.user.companyName || 'Tech Logistics Iberia S.L.',
      });
    } else {
      setError(res.error || 'Credenciales inválidas');
    }
    setLoading(false);
  };

  const setDemoCredentials = () => {
    setEmail('admin@techlogistics.es');
    setPassword('Admin1234!');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white font-black text-2xl shadow-xl shadow-emerald-500/20 mb-2">
            FX
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            FITX<span className="text-emerald-400">AI</span> Panel
          </h1>
          <p className="text-xs text-slate-400">
            Control Horario Empresarial · Acceso de Administrador
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center space-x-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@empresa.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center space-x-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/10"
            >
              <span>{loading ? 'Accediendo...' : 'Iniciar Sesión'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Acceso Rápido Demo */}
          <div className="pt-4 border-t border-slate-800/80 text-center">
            <button
              type="button"
              onClick={setDemoCredentials}
              className="text-[11px] text-slate-400 hover:text-emerald-400 underline transition"
            >
              Cargar credenciales de Administrador Demo
            </button>
          </div>
        </div>

        {/* Legal notice */}
        <div className="text-center text-[11px] text-slate-500 flex items-center justify-center space-x-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Cumplimiento RGPD y custodia legal de registros</span>
        </div>
      </div>
    </div>
  );
};
