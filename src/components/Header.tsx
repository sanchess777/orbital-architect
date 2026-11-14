import { useState } from 'react'
import { useLang } from '../i18n/LangContext'
import { inviteLink } from '../multiplayer/session'
import type { Lang } from '../types/game'

const LANGS: Lang[] = ['en', 'uk']

interface HeaderProps {
  roomCode?: string
  onLeave?: () => void
}

export default function Header({ roomCode, onLeave }: HeaderProps) {
  const { lang, setLang, t } = useLang()
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    if (!roomCode) return
    try {
      await navigator.clipboard.writeText(inviteLink(roomCode))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt(t.copyLink, inviteLink(roomCode))
    }
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-900/60 bg-slate-900/70 px-4 py-3">
      <div>
        <h1 className="text-lg font-bold tracking-widest text-cyan-400 sm:text-xl">{t.appTitle}</h1>
        <p className="text-xs text-slate-400">{t.appSubtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {roomCode && (
          <>
            <span className="rounded border border-slate-700 px-2 py-1 font-mono text-sm tracking-widest text-cyan-300">
              {t.room} {roomCode}
            </span>
            <button
              type="button"
              onClick={copyLink}
              className="rounded border border-slate-700 px-3 py-1 text-sm hover:border-cyan-500"
            >
              {copied ? t.linkCopied : t.copyLink}
            </button>
            {onLeave && (
              <button
                type="button"
                onClick={onLeave}
                className="rounded border border-slate-700 px-3 py-1 text-sm hover:border-red-500 hover:text-red-400"
              >
                {t.leave}
              </button>
            )}
          </>
        )}

        <div className="flex overflow-hidden rounded border border-slate-700">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-3 py-1 text-sm font-semibold ${
                lang === l ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}