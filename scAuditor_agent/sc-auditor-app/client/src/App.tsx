import { createBrowserRouter, RouterProvider, Outlet } from 'react-router';
import { Navbar } from '@/components/Navbar';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { AuditPage } from '@/pages/audit/AuditPage';
import { HistoryPage } from '@/pages/history/HistoryPage';
import { PatternsPage } from '@/pages/patterns/PatternsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

function Layout() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
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
  return <RouterProvider router={router} />;
}
