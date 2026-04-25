import { NavLink } from 'react-router';
import { ThemeSelector } from '@/ThemeProvider';
import { ICON_AGENT_BRICKS_CONTAINER } from '@/lib/brand';
import {
  LayoutDashboard,
  ScanSearch,
  ClipboardList,
  Route,
  Settings,
} from 'lucide-react';

const links = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/audit', label: 'New Audit', icon: <ScanSearch size={18} /> },
  { to: '/history', label: 'History', icon: <ClipboardList size={18} /> },
  { to: '/patterns', label: 'Patterns', icon: <Route size={18} /> },
  { to: '/settings', label: 'Settings', icon: <Settings size={18} /> },
];

export function Navbar() {
  return (
    <nav className="nav-surface text-white px-6 py-0 flex items-center justify-between transition-colors duration-[var(--motion-slow)]">
      {/* Left: Logo + Nav */}
      <div className="flex items-center gap-8">
        {/* Brand mark */}
        <div className="flex items-center gap-5 -my-3">
          <img
            src={ICON_AGENT_BRICKS_CONTAINER}
            alt="SC Auditor"
            className="w-[120px] h-[120px] rounded-2xl drop-shadow-xl"
          />
          <div className="flex flex-col">
            <span className="font-bold text-3xl tracking-tight leading-none">SC Auditor</span>
            <span className="text-sm text-white/50 font-medium tracking-widest uppercase leading-none mt-1.5">Screen Capture</span>
          </div>
        </div>

        {/* Navigation links */}
        <div className="flex items-center gap-1">
          {links.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-5 py-3.5 rounded-lg text-sm font-medium transition-all duration-[var(--motion-fast)] ${
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
