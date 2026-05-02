import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en'
import ptBR from './pt-BR'

const LANG_KEY = 'hub-czn.lang'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'pt-BR': { translation: ptBR },
  },
  lng: localStorage.getItem(LANG_KEY) ?? 'pt-BR',
  fallbackLng: 'pt-BR',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(LANG_KEY, lng)
})

export { LANG_KEY }
export default i18n
