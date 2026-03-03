import { format } from 'date-fns';
import { enUS, ar } from 'date-fns/locale';
import i18n from '../i18n';

const locales = {
  en: enUS,
  ar: ar,
};

export const formatLocalized = (date, formatStr = 'PPP') => {
  const currentLang = i18n.language || 'en';
  const locale = locales[currentLang] || enUS;
  return format(new Date(date), formatStr, { locale });
};
