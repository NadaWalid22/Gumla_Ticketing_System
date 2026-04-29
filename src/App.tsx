import { Link, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SubmissionPage from './pages/SubmissionPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import TicketHistoryPage from './pages/TicketHistoryPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { user, logout, isManagerOrSupport } = useAuth();

  return (
    <>
      {user && (
        <div className="global-nav">
            <span>Gumla Internal Ticketing</span>
          <div className="nav-actions">
            <Link to="/history">History</Link>
            <Link to="/change-password">Password</Link>
            {isManagerOrSupport && <Link to="/admin">Dashboard</Link>}
            <button type="button" onClick={() => void logout()}>
              Logout
            </button>
          </div>
        </div>
      )}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <SubmissionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <TicketHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireManager>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Routes>
    </>
  );
}
