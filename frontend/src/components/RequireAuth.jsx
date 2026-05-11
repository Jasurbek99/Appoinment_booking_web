import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

const STAFF = new Set(['secretary', 'assistant1', 'assistant2', 'assistant3']);
const BOSS = new Set(['boss1', 'boss2', 'boss3']);

export function RequireAuth({ children, allow }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-stone-500 text-sm">…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(user.role) && !roleMatches(user.role, allow)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function roleMatches(role, allow) {
  if (allow.includes('staff') && STAFF.has(role)) return true;
  if (allow.includes('boss') && BOSS.has(role)) return true;
  return false;
}
