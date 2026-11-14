import { useEffect } from 'react'
import { useLang } from '../i18n/LangContext'
import { attachPresence, claimRole, incrementCounter, releaseRole, removePlayer } from '../multiplayer/roomApi'
import { useRoom } from '../multiplayer/useRoom'
import type { PlayerRole } from '../types/game'
import PlayersPanel from './PlayersPanel'
import RolesPanel from './RolesPanel'

interface RoomScreenProps {
  code: string
  selfId: string
  onRemoved: () => void
}

export default function RoomScreen({ code, selfId, onRemoved }: RoomScreenProps) {
  const { t } = useLang()
  const { status, room } = useRoom(code, selfId)
  const isMember = room?.players.some((p) => p.id === selfId) ?? false

  useEffect(() => attachPresence(code, selfId), [code, selfId])

  // Якщо нас прибрали з кімнати, повертаємось на початок
  useEffect(() => {
    if (status === 'ready' && !isMember) onRemoved()
  }, [status, isMember, onRemoved])

  if (status === 'loading') {
    return <p className="p-8 text-center text-slate-400">{t.loading}</p>
  }

  if (status === 'missing' || !room) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4 text-slate-300">{t.roomClosed}</p>
        <button
          type="button"
          onClick={onRemoved}
          className="rounded bg-cyan-600 px-4 py-2 font-semibold hover:bg-cyan-500"
        >
          {t.backToStart}
        </button>
      </div>
    )
  }

  const handleTake = (role: PlayerRole) => {
    const present = new Set(room.players.filter((p) => p.online).map((p) => p.id))
    claimRole(code, role, selfId, present).catch(() => undefined)
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[320px_1fr]">
      <PlayersPanel
        room={room}
        selfId={selfId}
        onRemove={(id) => {
          removePlayer(code, id).catch(() => undefined)
        }}
      />

      <div className="space-y-4">
        <RolesPanel
          room={room}
          selfId={selfId}
          onTake={handleTake}
          onRelease={(role) => {
            releaseRole(code, role).catch(() => undefined)
          }}
        />

        <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">{t.sharedCounter}</h2>
          <p className="mt-1 text-xs text-slate-400">{t.counterHint}</p>
          <div className="mt-3 flex items-center gap-4">
            <span className="text-4xl font-bold tabular-nums text-cyan-300">{room.counter}</span>
            <button
              type="button"
              onClick={() => {
                incrementCounter(code).catch(() => undefined)
              }}
              className="rounded bg-cyan-600 px-4 py-2 font-semibold hover:bg-cyan-500"
            >
              +1
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}