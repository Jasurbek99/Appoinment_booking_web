import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index.js';

export function I18nProvider({ children }) {
  // Ensure i18n is initialized before children render.
  useEffect(() => {
    // i18n initialized at import time; nothing to do here.
  }, []);
  return children;
}

// Public hook compatible with the Step 8 stub: {lang, setLang, t}.
export function useI18n() {
  const { t, i18n: instance } = useTranslation();
  const [lang, setLangState] = useState(instance.language || 'ru');

  useEffect(() => {
    const onChange = (next) => setLangState(next);
    instance.on('languageChanged', onChange);
    return () => instance.off('languageChanged', onChange);
  }, [instance]);

  const setLang = useCallback(
    (next) => {
      instance.changeLanguage(next);
      if (typeof localStorage !== 'undefined') localStorage.setItem('lang', next);
    },
    [instance],
  );

  return { lang, setLang, t };
}

// Re-export for convenience.
export { i18n };
