import { NavLink } from 'react-router';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/audit', label: 'New Audit' },
  { to: '/history', label: 'History' },
  { to: '/patterns', label: 'Patterns' },
  { to: '/settings', label: 'Settings' },
];

export function Navbar() {
  return (
    <nav className="bg-[var(--dbx-navy-800)] text-white px-6 py-3 flex items-center gap-8">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-[var(--dbx-lava-600)] rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">SC</span>
        </div>
        <span className="font-bold text-lg tracking-tight">SC Auditor</span>
      </div>
      <div className="flex items-center gap-1">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
