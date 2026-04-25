import { createBrowserRouter, RouterProvider, Outlet } from 'react-router';
import { ThemeProvider } from '@/ThemeProvider';
import { Navbar } from '@/components/Navbar';
import { BRAND_DIAMOND_WHITE } from '@/lib/brand';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { AuditPage } from '@/pages/audit/AuditPage';
import { HistoryPage } from '@/pages/history/HistoryPage';
import { PatternsPage } from '@/pages/patterns/PatternsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

function Layout() {
  return (
    <div className="min-h-screen page-surface flex flex-col transition-colors duration-[var(--motion-slow)]">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="footer-surface text-white py-6 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <img src={BRAND_DIAMOND_WHITE} alt="Databricks" className="w-6 h-6 opacity-70" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/80 leading-none">SC Auditor</span>
              <span className="text-[10px] text-white/40 leading-none mt-0.5">Screen Capture Audit Tool</span>
            </div>
          </div>

          {/* Center: Powered by */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">Powered by</span>
            <span className="text-xs font-semibold text-white/60 tracking-wide">Databricks</span>
          </div>

          {/* Right: Copyright */}
          <p className="text-[10px] text-white/30">
            &copy; {new Date().getFullYear()} Databricks, Inc.
          </p>
        </div>
      </footer>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/audit', element: <AuditPage /> },
      { path: '/audit/:sessionId', element: <AuditPage /> },
      { path: '/history', element: <HistoryPage /> },
      { path: '/patterns', element: <PatternsPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
]);

export default function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
