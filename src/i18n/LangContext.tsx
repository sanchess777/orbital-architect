import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Lang, LocalizedText } from '../types/game'
import { UI_TEXT, type Dict } from './translations'

interface LangContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Dict
  pick: (text: LocalizedText) => string
}

const LangContext = createContext<LangContextValue | null>(null)

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem('oa.lang')
    if (saved === 'en' || saved === 'uk') return saved
  } catch {
    // сховище недоступне: беремо мову браузера
  }
  return navigator.language.toLowerCase().startsWith('uk') ? 'uk' : 'en'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem('oa.lang', next)
    } catch {
      // нічого страшного
    }
  }, [])

  const value = useMemo<LangContextValue>(
    () => ({ lang, setLang, t: UI_TEXT[lang], pick: (text) => text[lang] }),
    [lang, setLang],
  )

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>')
  return ctx
}