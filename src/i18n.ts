import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ltCommon from './locales/lt/common.json';
import enCommon from './locales/en/common.json';

const resources = {
    lt: { common: ltCommon },
    en: { common: enCommon },
};

i18n.use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'lt',
        defaultNS: 'common',
        ns: ['common'],
        interpolation: {
            escapeValue: false, // React already escapes
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        },
    })
    .catch((err) => {
        console.error('i18n init error:', err);
    });

export default i18n;
