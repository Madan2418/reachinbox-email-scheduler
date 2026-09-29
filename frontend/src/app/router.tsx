import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useMe } from '../api/hooks';
import LoginPage from '../pages/Login';
import DashboardPage from '../pages/Dashboard';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useMe();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f5f7ff', gap: 12, color: '#5b6474', fontFamily: 'sans-serif' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#3346ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 13 }}>Loading ReachInbox...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (isError || !data?.user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
