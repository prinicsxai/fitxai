import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  MapPin, 
  Calendar, 
  FileBarChart, 
  AlertTriangle, 
  ShieldAlert, 
  Settings, 
  UserCircle,
  Building2,
  LogOut,
  X
} from 'lucide-react';
import { SidebarSection, UserProfile } from '../types';

interface SidebarProps {
  activeSection: SidebarSection;
  onSelectSection: (section: SidebarSection) => void;
  user: UserProfile | null;
  onLogout: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  user,
  onLogout,
  isOpenMobile,
  onCloseMobile,
}) => {
  const menuItems: { id: SidebarSection; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'employees', label: 'Trabajadores', icon: <Users className="w-5 h-5" /> },
    { id: 'attendance', label: 'Fichajes', icon: <Clock className="w-5 h-5" /> },
    { id: 'map', label: 'Mapa', icon: <MapPin className="w-5 h-5" /> },
    { id: 'schedules', label: 'Horarios', icon: <Calendar className="w-5 h-5" /> },
    { id: 'reports', label: 'Informes', icon: <FileBarChart className="w-5 h-5" /> },
    { id: 'incidents', label: 'Incidencias', icon: <AlertTriangle className="w-5 h-5" /> },
    { id: 'audit', label: 'Auditoría', icon: <ShieldAlert className="w-5 h-5" /> },
    { id: 'settings', label: 'Configuración', icon: <Settings className="w-5 h-5" /> },
    { id: 'account', label: 'Mi cuenta', icon: <UserCircle className="w-5 h-5" /> },
  ];

  const handleSelect = (id: SidebarSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-slate-950/70 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-950 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out
        lg:static lg:translate-x-0 ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand / Logo */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/20">
              FX
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                FITX<span className="text-emerald-400">AI</span>
              </span>
              <span className="text-[10px] text-emerald-400/90 font-semibold uppercase tracking-wider block">
                Enterprise
              </span>
            </div>
          </div>
          <button 
            onClick={onCloseMobile} 
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Company Card in Sidebar */}
        <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/30">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-medium text-slate-300 truncate" title={user?.companyName || 'Empresa'}>
              {user?.companyName || 'Empresa Activa'}
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`
                  w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${isActive 
                    ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30 shadow-sm shadow-emerald-950' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'}
                `}
              >
                <span className={isActive ? 'text-emerald-400' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs uppercase">
                {user ? `${user.firstName?.[0] || 'A'}${user.lastName?.[0] || 'D'}` : 'AD'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-200 truncate">
                  {user ? `${user.firstName} ${user.lastName}` : 'Administrador'}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user?.email || 'admin@empresa.com'}
                </p>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
