import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './ru.json';
import tk from './tk.json';

const stored = (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'ru';

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    tk: { translation: tk },
  },
  lng: stored,
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
