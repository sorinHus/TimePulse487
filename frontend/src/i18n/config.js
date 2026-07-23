import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en'
import ro from './locales/ro'
import uk from './locales/uk'

const STORAGE_KEY = 'timepulse-lang'
export const SUPPORTED_LANGUAGES = ['ro', 'en', 'uk']

const DATE_LOCALES = { ro: 'ro-RO', uk: 'uk-UA', en: 'en-GB' }

export function dateLocale(lang) {
  return DATE_LOCALES[lang] || DATE_LOCALES.en
}

function initialLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (SUPPORTED_LANGUAGES.includes(stored)) return stored
  const browserLang = navigator.language?.toLowerCase()
  if (browserLang?.startsWith('ro')) return 'ro'
  if (browserLang?.startsWith('uk')) return 'uk'
  return 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ro: { translation: ro },
    uk: { translation: uk },
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
