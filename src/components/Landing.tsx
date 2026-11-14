import { useState } from 'react'
import { useLang } from '../i18n/LangContext'
import { CODE_LENGTH, normalizeCode } from '../multiplayer/session'
import type { JoinError } from '../types/game'

interface LandingProps {
  initialName: string
  initialCode: string
  busy: boolean
  error: JoinError | null
  onCreate: (name: string) => void
  onJoin: (name: string, code: string) => void
}

export default function Landing({ initialName, initialCode, busy, error, onCreate, onJoin }: LandingProps) {
  const { t } = useLang()
  const [name, setName] = useState(initialName)
  const [code, setCode] = useState(initialCode)
  const [localError, setLocalError] = useState<'name' | 'code' | null>(null)

  const messages = {
    name: t.nameRequired,
    code: t.codeInvalid,
    notFound: t.errNotFound,
    full: t.errFull,
    generic: t.errGeneric,
  }
  const shown = localError ?? error
  const errorText = shown ? messages[shown] : null

  function submit(kind: 'create' | 'join') {
    const trimmed = name.trim()
    if (!trimmed) {
      setLocalError('name')
      return
    }
    if (kind === 'create') {
      setLocalError(null)
      onCreate(trimmed)
      return
    }
    const normalized = normalizeCode(code)
    if (normalized.length !== CODE_LENGTH) {
      setLocalError('code')
      return
    }
    setLocalError(null)
    onJoin(trimmed, normalized)
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <p className="mb-8 text-center text-slate-300">{t.tagline}</p>

      <div className="space-y-6 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-400">{t.yourName}</span>
          <input
            value={name}
            maxLength={20}
            placeholder={t.namePlaceholder}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-500"
          />
        </label>

        <div>
          <button
            type="button"
            disabled={busy}
            onClick={() => submit('create')}
            className="w-full rounded bg-cyan-600 px-4 py-2 font-semibold hover:bg-cyan-500 disabled:opacity-50"
          >
            {busy ? t.working : t.createRoom}
          </button>
          <p className="mt-2 text-xs text-slate-400">{t.createHint}</p>
        </div>

        <div className="flex items-center gap-3 text-xs uppercase text-slate-500">
          <span className="h-px flex-1 bg-slate-800" />
          {t.orJoin}
          <span className="h-px flex-1 bg-slate-800" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit('join')
          }}
          className="flex gap-2"
        >
          <input
            aria-label={t.roomCode}
            value={code}
            maxLength={CODE_LENGTH}
            placeholder={t.roomCode}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono uppercase tracking-widest outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded border border-cyan-600 px-4 py-2 font-semibold text-cyan-400 hover:bg-cyan-950 disabled:opacity-50"
          >
            {t.joinRoom}
          </button>
        </form>

        {errorText && (
          <p role="alert" className="text-sm text-red-400">
            {errorText}
          </p>
        )}
      </div>
    </main>
  )
}