import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './context/auth.jsx';
import { Spinner } from './components/common.jsx';
import AppShell from './components/shell.jsx';
import Welcome from './pages/Welcome.jsx';
import { Login, Signup } from './pages/Auth.jsx';
import Connect from './pages/Connect.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Inbox from './pages/Inbox.jsx';
import Accounts from './pages/Accounts.jsx';
import AskAI from './pages/AskAI.jsx';
import { ClientHome, ClientThread } from './pages/Client.jsx';
import NotFound from './pages/NotFound.jsx';

function FullLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <span className="brand__mark" style={{ width: 42, height: 42, borderRadius: 13, margin: '0 auto 14px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
        </span>
        <div className="row gap-8" style={{ justifyContent: 'center', color: 'var(--text-3)', fontSize: 13.5 }}>
          <Spinner /> Loading your workspace…
        </div>
      </div>
    </div>
  );
}

function Guard({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'client' ? '/client' : '/app'} replace />;
  }
  return children;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (user) return <Navigate to={user.role === 'client' ? '/client' : '/app'} replace />;
  return <Welcome />;
}

function AuthGate({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (user) return <Navigate to={user.role === 'client' ? '/client' : '/app'} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<AuthGate><Login /></AuthGate>} />
      <Route path="/signup" element={<AuthGate><Signup /></AuthGate>} />
      <Route
        path="/connect"
        element={
          <Guard role="assistant">
            <Connect />
          </Guard>
        }
      />
      <Route
        path="/app"
        element={
          <Guard role="assistant">
            <AppShell />
          </Guard>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="inbox/:segment" element={<Inbox />} />
        <Route path="inbox/:segment/:id" element={<Inbox />} />
        <Route path="ask" element={<AskAI />} />
        <Route path="accounts" element={<Accounts />} />
      </Route>
      <Route path="/app/*" element={<Outlet />} />
      <Route
        path="/client"
        element={
          <Guard role="client">
            <ClientHome />
          </Guard>
        }
      />
      <Route
        path="/client/:id"
        element={
          <Guard role="client">
            <ClientThread />
          </Guard>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
