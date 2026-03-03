import { useTranslation } from 'react-i18next';
import { useAuth } from './useAuth';
import { driverService as api } from '../services/driver.service';

/**
 * Custom hook to handle language switching logic across the application.
 * Centralizes i18n changes, auth context updates, and API persistence.
 */
export function useLanguage() {
  const { i18n, t } = useTranslation();
  const { updateUser } = useAuth();

  const toggleLanguage = async () => {
    const nextLang = i18n.language === 'ar' ? 'en' : 'ar';

    // 1. Update i18next local state
    i18n.changeLanguage(nextLang);

    // 2. Update Auth Context (UI responsiveness)
    updateUser({ languagePreference: nextLang });

    // 3. Persist to Backend
    try {
      await api.updatePreferences({ languagePreference: nextLang });
    } catch (err) {
      console.error('Failed to save language preference:', err);
    }
  };

  return {
    language: i18n.language,
    isAr: i18n.language === 'ar',
    toggleLanguage,
    t
  };
}
