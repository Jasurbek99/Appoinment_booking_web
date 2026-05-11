import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient.js';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { I18nProvider } from './contexts/I18nProvider.jsx';
import { SocketProvider } from './contexts/SocketContext.jsx';
import { ToastProvider } from './contexts/ToastProvider.jsx';
import { RequireAuth } from './components/RequireAuth.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { StaffDashboard } from './pages/StaffDashboard.jsx';
import { BossDashboard } from './pages/BossDashboard.jsx';
import { WorkerStatusPage } from './pages/WorkerStatusPage.jsx';
import { HomeRedirect } from './pages/HomeRedirect.jsx';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <SocketProvider>
            <ToastProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/status" element={<WorkerStatusPage />} />
                  <Route
                    path="/dashboard/staff"
                    element={
                      <RequireAuth allow={['staff']}>
                        <StaffDashboard />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/dashboard/boss"
                    element={
                      <RequireAuth allow={['boss']}>
                        <BossDashboard />
                      </RequireAuth>
                    }
                  />
                  <Route path="/" element={<HomeRedirect />} />
                  <Route path="*" element={<HomeRedirect />} />
                </Routes>
              </BrowserRouter>
            </ToastProvider>
          </SocketProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
