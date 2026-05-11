// Step 8 stub. Step 15 replaces this with real react-i18next wiring.
// Exposing the same {lang, setLang, t} surface now means components written
// in steps 9-14 won't need touch-ups when i18n lands.

import { createContext, useContext, useState, useCallback } from 'react';

const I18nContext = createContext(null);

const FALLBACK = {
  ru: {
    appName: 'Запись на приём',
    today: 'Сегодня',
    future: 'Будущие',
    journal: 'Журнал',
    settings: 'Настройки',
    analytics: 'Аналитика',
    login: 'Войти',
    logout: 'Выйти',
    username: 'Логин',
    password: 'Пароль',
  },
  tk: {
    appName: 'Kabula ýazylyş',
    today: 'Şu gün',
    future: 'Geljekki',
    journal: 'Žurnal',
    settings: 'Sazlamalar',
    analytics: 'Analitika',
    login: 'Girmek',
    logout: 'Çykmak',
    username: 'Login',
    password: 'Açar söz',
  },
};

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || 'ru');

  const setLang = useCallback((next) => {
    setLangState(next);
    localStorage.setItem('lang', next);
  }, []);

  const t = useCallback(
    (key) => FALLBACK[lang]?.[key] ?? FALLBACK.ru[key] ?? key,
    [lang],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
