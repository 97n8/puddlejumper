import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import SetupGate from './setup/SetupGate';
import Workbench from './workbench/Workbench';

function AuthGuard({ children }) {
  const token    = useAuthStore(s => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const rehydrate = useAuthStore(s => s.rehydrate);

  useEffect(() => {
    rehydrate();
    // Handle SSO callback token in URL
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('token');
    if (ssoToken) {
      const setAuth = useAuthStore.getState().setAuth;
      setAuth({ token: ssoToken, actor: {}, jurisdiction: null });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup/*" element={
        <AuthGuard><SetupGate /></AuthGuard>
      } />
      <Route path="/workbench/*" element={
        <AuthGuard><Workbench /></AuthGuard>
      } />
      <Route path="*" element={<Navigate to="/workbench" replace />} />
    </Routes>
  );
}
