import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en'
import ro from './locales/ro'

const STORAGE_KEY = 'timepulse-lang'

function initialLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'ro') return stored
  return navigator.language?.toLowerCase().startsWith('ro') ? 'ro' : 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ro: { translation: ro },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    // React already escapes output - i18next's own escaping would double-escape
    // characters like "&" in the text.
    escapeValue: false,
  },
})

export function setLanguage(lang) {
  localStorage.setItem(STORAGE_KEY, lang)
  i18n.changeLanguage(lang)
}

export default i18n
