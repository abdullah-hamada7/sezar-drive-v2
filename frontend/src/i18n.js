import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    parseMissingKeyHandler: (key) => {
      if (typeof key === 'string' && key.startsWith('common.')) {
        const raw = key.slice('common.'.length);
        const tail = raw.split('.').pop() || raw;
        return tail.replace(/_/g, ' ');
      }
      return key;
    },
    react: {
      useSuspense: true,
    },
  });

export default i18n;
