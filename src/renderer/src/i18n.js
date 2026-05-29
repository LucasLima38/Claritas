import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ptBR from './locales/pt-BR/translation.json'
import ptPT from './locales/pt-PT/translation.json'
import en from './locales/en/translation.json'
import de from './locales/de/translation.json'
import es from './locales/es/translation.json'
import fr from './locales/fr/translation.json'
import it from './locales/it/translation.json'
import ru from './locales/ru/translation.json'
import ja from './locales/ja/translation.json'
import ko from './locales/ko/translation.json'
import zhCN from './locales/zh-CN/translation.json'
import zhTW from './locales/zh-TW/translation.json'

i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
    'pt-PT': { translation: ptPT },
    en: { translation: en },
    de: { translation: de },
    es: { translation: es },
    fr: { translation: fr },
    it: { translation: it },
    ru: { translation: ru },
    ja: { translation: ja },
    ko: { translation: ko },
    'zh-CN': { translation: zhCN },
    'zh-TW': { translation: zhTW },
  },
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  interpolation: { escapeValue: false },
})

export default i18n
