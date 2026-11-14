import type { ReactNode } from 'react'
import { claimQuota, ROLES, ROLE_INFO } from '../engine/roles'
import { useLang } from '../i18n/LangContext'
import type { PlayerRole, RoomState } from '../types/game'

interface RolesPanelProps {
  room: RoomState
  selfId: string
  onTake: (role: PlayerRole) => void
  onRelease: (role: PlayerRole) => void
}

export default function RolesPanel({ room, selfId, onTake, onRelease }: RolesPanelProps) {
  const { t, pick } = useLang()

  const activeCount = room.players.filter((p) => p.online).length
  const solo = activeCount <= 1
  const isHost = room.hostId === selfId
  const quota = claimQuota(activeCount)
  const myCount = ROLES.filter((r) => room.roleOwners[r] === selfId).length
  const nameOf = (id: string) => room.players.find((p) => p.id === id)?.name ?? '?'

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-cyan-400">{t.roles}</h2>
      <p className="mb-3 text-xs text-slate-400">{solo ? t.rolesSolo : t.rolesTeam}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {ROLES.map((role) => {
          const info = ROLE_INFO[role]
          const ownerId = room.roleOwners[role]
          const mine = ownerId === selfId

          // Кнопки бачить лише гість: власник отримує те, що лишилось
          let action: ReactNode = null
          if (!solo && !isHost) {
            if (mine) {
              action = (
                <button
                  type="button"
                  onClick={() => onRelease(role)}
                  className="rounded border border-slate-600 px-2 py-1 text-xs hover:border-red-500 hover:text-red-400"
                >
                  {t.release}
                </button>
              )
            } else if (ownerId === room.hostId) {
              action = (
                <button
                  type="button"
                  disabled={myCount >= quota}
                  onClick={() => onTake(role)}
                  className="rounded bg-cyan-600 px-2 py-1 text-xs font-semibold hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t.take}
                </button>
              )
            }
          }

          return (
            <div
              key={role}
              className={`rounded border p-3 ${
                mine ? 'border-cyan-500 bg-cyan-950/30' : 'border-slate-800 bg-slate-950/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{pick(info.name)}</h3>
                  <p className="text-xs text-cyan-500">{pick(info.segment)}</p>
                </div>
                {action}
              </div>
              <p className="mt-2 text-xs text-slate-400">{pick(info.description)}</p>
              <p className="mt-2 text-xs text-slate-300">
                {t.heldBy}: <span className="font-medium">{nameOf(ownerId)}</span>
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}