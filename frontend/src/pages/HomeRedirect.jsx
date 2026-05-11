import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

const STAFF = new Set(['secretary', 'assistant1', 'assistant2', 'assistant3']);
const BOSS = new Set(['boss1', 'boss2', 'boss3']);

export function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (BOSS.has(user.role)) return <Navigate to="/dashboard/boss" replace />;
  if (STAFF.has(user.role)) return <Navigate to="/dashboard/staff" replace />;
  return <Navigate to="/login" replace />;
}
