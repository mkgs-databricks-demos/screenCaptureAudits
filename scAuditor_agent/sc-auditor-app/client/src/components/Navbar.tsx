import { NavLink } from 'react-router';
import { ThemeSelector } from '@/ThemeProvider';
import {
  LayoutDashboard,
  ScanSearch,
  ClipboardList,
  Route,
  Settings,
} from 'lucide-react';

const links = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
  { to: '/audit', label: 'New Audit', icon: <ScanSearch size={16} /> },
  { to: '/history', label: 'History', icon: <ClipboardList size={16} /> },
  { to: '/patterns', label: 'Patterns', icon: <Route size={16} /> },
  { to: '/settings', label: 'Settings', icon: <Settings size={16} /> },
];

export function Navbar() {
  return (
    <nav className="bg-[var(--surface-nav)] text-white px-6 py-0 flex items-center justify-between transition-colors duration-[var(--motion-slow)]">
      {/* Left: Logo + Nav */}
      <div className="flex items-center gap-8">
        {/* Brand mark */}
        <div className="flex items-center gap-3 py-3">
          <div className="w-9 h-9 bg-gradient-to-br from-[var(--dbx-lava-600)] to-[var(--dbx-lava-700)] rounded-xl flex items-center justify-center shadow-lg shadow-[var(--dbx-lava-600)]/20">
            <ScanSearch size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight leading-none">SC Auditor</span>
            <span className="text-[10px] text-white/50 font-medium tracking-widest uppercase leading-none mt-0.5">Screen Capture</span>
          </div>
        </div>

        {/* Navigation links */}
        <div className="flex items-center gap-0.5">
          {links.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-[var(--motion-fast)] ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {icon}
              <span className="hidden md:inline">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Right: Theme selector */}
      <ThemeSelector />
    </nav>
  );
}
