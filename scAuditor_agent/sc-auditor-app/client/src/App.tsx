import { createBrowserRouter, RouterProvider, Outlet } from 'react-router';
import { ThemeProvider } from '@/ThemeProvider';
import { Navbar } from '@/components/Navbar';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { AuditPage } from '@/pages/audit/AuditPage';
import { HistoryPage } from '@/pages/history/HistoryPage';
import { PatternsPage } from '@/pages/patterns/PatternsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

function Layout() {
  return (
    <div className="min-h-screen bg-[var(--surface-secondary)] flex flex-col transition-colors duration-[var(--motion-slow)]">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-[var(--border-subtle)] py-3 px-6">
        <p className="text-xs text-[var(--text-tertiary)] text-center">
          SC Auditor &mdash; Powered by Databricks
        </p>
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
