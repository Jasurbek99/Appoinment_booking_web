import { useAuth } from '../contexts/AuthContext.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { Btn } from './primitives.jsx';

export function TopBar({ title, children }) {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useI18n();

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <h1 className="font-semibold">{title || t('appName')}</h1>
        <div className="flex-1">{children}</div>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setLang(lang === 'ru' ? 'tk' : 'ru')}
            className="text-stone-600 hover:text-stone-900 px-2"
            title={lang}
          >
            {lang.toUpperCase()}
          </button>
          {user && (
            <>
              <span className="text-stone-500">{user.displayName}</span>
              <Btn kind="ghost" size="sm" onClick={logout}>
                {t('logout')}
              </Btn>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
