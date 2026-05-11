import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { Btn, Input } from '../components/primitives.jsx';
import { ApiError } from '../lib/api.js';

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Неверный логин или пароль');
      } else {
        setError('Не удалось войти');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 space-y-4"
      >
        <h1 className="text-lg font-semibold">{t('appName')}</h1>
        <div>
          <label className="text-sm text-stone-600">{t('username')}</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </div>
        <div>
          <label className="text-sm text-stone-600">{t('password')}</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <Btn type="submit" disabled={submitting} className="w-full">
          {t('login')}
        </Btn>
      </form>
    </main>
  );
}
