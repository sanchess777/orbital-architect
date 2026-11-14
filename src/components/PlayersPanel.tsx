import { MAX_PLAYERS, ROLES, ROLE_INFO } from '../engine/roles'
import { useLang } from '../i18n/LangContext'
import type { RoomState } from '../types/game'

interface PlayersPanelProps {
  room: RoomState
  selfId: string
  onRemove: (id: string) => void
}

export default function PlayersPanel({ room, selfId, onRemove }: PlayersPanelProps) {
  const { t, pick } = useLang()

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-cyan-400">
        <span>{t.players}</span>
        <span className="text-slate-400">
          {room.players.length}/{MAX_PLAYERS}
        </span>
      </h2>

      <ul className="space-y-2">
        {room.players.map((p) => {
          const held = ROLES.filter((r) => room.roleOwners[r] === p.id)
          return (
            <li key={p.id} className="rounded border border-slate-800 bg-slate-950/60 p-2">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${p.online ? 'bg-emerald-400' : 'bg-slate-600'}`}
                  title={p.online ? t.online : t.offline}
                />
                <span className="font-medium">{p.name}</span>
                {p.id === selfId && (
                  <span className="rounded bg-slate-800 px-1.5 text-xs text-slate-300">{t.you}</span>
                )}
                {p.id === room.hostId && (
                  <span className="rounded bg-amber-900/60 px-1.5 text-xs text-amber-300">{t.host}</span>
                )}
                {!p.online && p.id !== selfId && (
                  <button
                    type="button"
                    onClick={() => onRemove(p.id)}
                    className="ml-auto text-xs text-slate-400 hover:text-red-400"
                  >
                    ✕ {t.removePlayer}
                  </button>
                )}
              </div>
              {held.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {held.map((r) => (
                    <span key={r} className="rounded bg-cyan-950 px-2 py-0.5 text-xs text-cyan-300">
                      {pick(ROLE_INFO[r].name)}
                    </span>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}