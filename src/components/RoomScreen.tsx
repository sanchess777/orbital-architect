import { useEffect, useMemo, useState } from 'react'
import { TARGETS, TARGET_ORDER } from '../engine/catalog'
import { solveMission } from '../engine/solver'
import { useLang } from '../i18n/LangContext'
import {
  attachPresence,
  claimRole,
  launchMission,
  releaseRole,
  removePlayer,
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
  const isMember = room?.players.some((p) => p.id === selfId) ?? false

  useEffect(() => attachPresence(code, selfId), [code, selfId])

  useEffect(() => {
    if (status === 'ready' && !isMember) onRemoved()
  }, [status, isMember, onRemoved])

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

  const handleTake = (role: PlayerRole) => {
    const present = new Set(room.players.filter((p) => p.online).map((p) => p.id))
    claimRole(code, role, selfId, present).catch(() => undefined)
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
            onRelease={(role) => {
              releaseRole(code, role).catch(() => undefined)
            }}
          />

          {/* Вибір цілі місії власником */}
          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
              {t.selectTargetTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-400">{t.selectTargetHint}</p>

            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {TARGET_ORDER.map((tid) => {
                const trg = TARGETS[tid]
                const active = selectedTarget === tid
                return (
                  <button
                    key={tid}
                    type="button"
                    disabled={!isHost}
                    onClick={() => setSelectedTarget(tid)}
                    className={`rounded-md border p-3 text-left transition ${
                      active
                        ? 'border-cyan-400 bg-cyan-950/40'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    } disabled:cursor-default`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-100">{pick(trg.name)}</span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
                        {trg.bClassM} M$
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                      <span>
                        {t.targetFlight}: {trg.flightDays} {t.daysUnit}
                      </span>
                      <span>
                        {t.targetLife}: {trg.tNomMonths} {t.monthsUnit}
                      </span>
                      <span>
                        {t.targetScienceMin}: {trg.sMin} pts
                      </span>
                    </div>
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
      {/* Компактний заголовок місії */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-cyan-300">{pick(currentTarget.name)}</span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
            Δv {currentTarget.dvKmS} km/s
          </span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
            {t.attemptLabel} #{room.attempt}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>
            {t.players}: {room.players.filter((p) => p.online).length}/4
          </span>
        </div>
      </div>

      {/* Верхня панель 8 метрик (видна всім учасникам) */}
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