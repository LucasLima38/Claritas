import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ptBR from './locales/pt-BR/translation.json'
import ptPT from './locales/pt-PT/translation.json'
import en from './locales/en/translation.json'
import de from './locales/de/translation.json'

i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
    'pt-PT': { translation: ptPT },
    en: { translation: en },
    de: { translation: de },
  },
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  interpolation: { escapeValue: false },
})

export default i18n
