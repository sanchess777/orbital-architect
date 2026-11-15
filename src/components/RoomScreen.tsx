import { useEffect, useMemo, useState } from 'react'
import { TARGETS, TARGET_ORDER } from '../engine/catalog'
import { ROLES } from '../engine/roles'
import { solveMission } from '../engine/solver'
import { useLang } from '../i18n/LangContext'
import {
  attachPresence,
  claimRole,
  launchMission,
  releaseRole,
  removePlayer,
  returnToLobby,
  setRoleReady,
  startMissionDesign,
} from '../multiplayer/roomApi'
import { useRoom } from '../multiplayer/useRoom'
import type { PlayerRole, TargetId } from '../types/game'
import MetricsBar from './MetricsBar'
import MissionReportScreen from './MissionReportScreen'
import OrbitVisualizer from './OrbitVisualizer'
import PlayersPanel from './PlayersPanel'
import RoleWorkbench from './RoleWorkbench'
import RolesPanel from './RolesPanel'

interface RoomScreenProps {
  code: string
  selfId: string
  onRemoved: () => void
}

export default function RoomScreen({ code, selfId, onRemoved }: RoomScreenProps) {
  const { t, pick } = useLang()
  const { status, room } = useRoom(code, selfId)
  const [selectedTarget, setSelectedTarget] = useState<TargetId>('leo')
  const [rolesDrawerOpen, setRolesDrawerOpen] = useState(false)
  const isMember = room?.players.some((p) => p.id === selfId) ?? false

  useEffect(() => attachPresence(code, selfId), [code, selfId])

  useEffect(() => {
    if (status === 'ready' && !isMember) onRemoved()
  }, [status, isMember, onRemoved])

  useEffect(() => {
    if (room?.phase === 'lobby') {
      setSelectedTarget(room.config.targetId)
    }
  }, [room?.phase, room?.config.targetId])

  const report = useMemo(() => {
    if (!room) return null
    return solveMission(room.config, room.seed, room.attempt)
  }, [room])

  if (status === 'loading') {
    return <p className="p-8 text-center text-slate-400">{t.loading}</p>
  }

  if (status === 'missing' || !room || !report) {
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

  const isHost = room.hostId === selfId
  const myRolesCount = ROLES.filter((r) => room.roleOwners[r] === selfId).length

  const handleTake = (role: PlayerRole) => {
    const present = new Set(room.players.filter((p) => p.online).map((p) => p.id))
    claimRole(code, role, selfId, present)
      .then((ok) => {
        if (ok) setRoleReady(code, role, false).catch(() => undefined)
      })
      .catch(() => undefined)
  }

  const handleRelease = (role: PlayerRole) => {
    releaseRole(code, role)
      .then(() => {
        setRoleReady(code, role, false).catch(() => undefined)
      })
      .catch(() => undefined)
  }

  /* ==================== ФАЗА 1: ЛОБІ ТА ВИБІР ЦІЛІ МІСІЇ ==================== */
  if (room.phase === 'lobby') {
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
            onRelease={handleRelease}
          />

          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
              {t.selectTargetTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-400">{t.selectTargetHint}</p>

            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              {TARGET_ORDER.map((tid) => {
                const trg = TARGETS[tid]
                const active = selectedTarget === tid
                return (
                  <button
                    key={tid}
                    type="button"
                    disabled={!isHost}
                    onClick={() => setSelectedTarget(tid)}
                    className={`flex flex-col justify-between rounded-md border p-3 text-left transition ${
                      active
                        ? 'border-cyan-400 bg-cyan-950/40'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    } disabled:cursor-default`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-slate-100">{pick(trg.name)}</span>
                      <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
                        {trg.bClassM} M$
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      {pick(trg.goal)}
                    </p>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex items-center justify-end">
              {isHost ? (
                <button
                  type="button"
                  onClick={() => {
                    startMissionDesign(code, selectedTarget).catch(() => undefined)
                  }}
                  className="rounded-md bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-500"
                >
                  {t.startDesignBtn}
                </button>
              ) : (
                <p className="text-xs text-slate-400">{t.waitingForHost}</p>
              )}
            </div>
          </section>
        </div>
      </main>
    )
  }

  /* ==================== ФАЗА 2 ТА 3: КОНСТРУКТОР І ЗВІТ ==================== */
  const currentTarget = TARGETS[room.config.targetId]

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-cyan-300">{pick(currentTarget.name)}</span>
          {isHost && (
            <button
              type="button"
              onClick={() => {
                returnToLobby(code).catch(() => undefined)
              }}
              className="rounded border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-xs text-slate-300 transition hover:border-cyan-500 hover:text-cyan-200"
            >
              ← {t.backToLobby}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {t.players}: {room.players.filter((p) => p.online).length}/4
          </span>
          <button
            type="button"
            onClick={() => setRolesDrawerOpen((v) => !v)}
            className={`rounded border px-3 py-1 text-xs font-semibold transition ${
              rolesDrawerOpen
                ? 'border-cyan-400 bg-cyan-600/30 text-cyan-200'
                : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-cyan-500'
            }`}
          >
            {rolesDrawerOpen ? t.hideRolesBtn : t.crewAndRolesBtn}
          </button>
        </div>
      </div>

      {myRolesCount === 0 && !rolesDrawerOpen && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/50 bg-amber-950/30 px-4 py-2.5 text-xs text-amber-200">
          <span>{t.noRoleBanner}</span>
          <button
            type="button"
            onClick={() => setRolesDrawerOpen(true)}
            className="rounded bg-amber-500 px-3 py-1.5 font-bold text-slate-950 transition hover:bg-amber-400"
          >
            {t.pickRoleBtn}
          </button>
        </div>
      )}

      {rolesDrawerOpen && (
        <section className="grid gap-4 rounded-lg border border-cyan-500/40 bg-slate-900/90 p-4 lg:grid-cols-[320px_1fr]">
          <PlayersPanel
            room={room}
            selfId={selfId}
            onRemove={(id) => {
              removePlayer(code, id).catch(() => undefined)
            }}
          />
          <RolesPanel
            room={room}
            selfId={selfId}
            onTake={handleTake}
            onRelease={handleRelease}
          />
        </section>
      )}

      <MetricsBar report={report} />

      {room.phase === 'design' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <RoleWorkbench
            room={room}
            selfId={selfId}
            report={report}
            onLaunch={() => {
              launchMission(code).catch(() => undefined)
            }}
          />
          <OrbitVisualizer config={room.config} report={report} />
        </div>
      ) : (
        <MissionReportScreen roomCode={code} config={room.config} report={report} />
      )}
    </main>
  )
}