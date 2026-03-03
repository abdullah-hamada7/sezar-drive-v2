const en = require('../locales/en.json');
const ar = require('../locales/ar.json');

const locales = { en, ar };

/**
 * Middleware to detect language from Accept-Language header or user preference.
 */
function i18n(req, res, next) {
  // Attach a dynamic t function that resolves language at runtime
  req.t = (key) => {
    // Determine language: 
    // 1. User preference from DB (attached by auth middleware)
    // 2. Accept-Language header
    // 3. Default to English
    let lang = 'en';

    if (req.user && req.user.languagePreference) {
      lang = req.user.languagePreference;
    } else {
      const acceptLang = req.headers['accept-language'];
      if (acceptLang) {
        const preferred = acceptLang.split(',')[0].split('-')[0].toLowerCase();
        if (locales[preferred]) {
          lang = preferred;
        }
      }
    }

    req.language = lang; // Update for logging/downstream use

    const keys = key.split('.');
    let value = locales[lang];
    for (const k of keys) {
      if (value && value[k]) {
        value = value[k];
      } else {
        return key; // Fallback to key itself
      }
    }
    return value;
  };

  next();
}

module.exports = i18n;
