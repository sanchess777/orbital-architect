import { useState } from 'react'
import {
  ADCS_LIST,
  BATTERIES,
  ENGINES,
  GROUND_STATION_COSTS_M,
  INSTRUMENTS,
  MEMORIES,
  PLATFORMS,
  PROCESSORS,
  RADIOS,
  ROCKETS,
  SOLAR_PANELS,
  SYNERGIES,
  TARGETS,
} from '../engine/catalog'
import { ROLES, ROLE_INFO } from '../engine/roles'
import { useLang } from '../i18n/LangContext'
import { setRoleReady, updateMissionConfig } from '../multiplayer/roomApi'
import type {
  DutyCycleId,
  GroundStationCount,
  MissionConfig,
  MissionReport,
  PlayerRole,
  RoomState,
} from '../types/game'

interface RoleWorkbenchProps {
  room: RoomState
  selfId: string
  report: MissionReport
  onLaunch: () => void
}

export default function RoleWorkbench({ room, selfId, report, onLaunch }: RoleWorkbenchProps) {
  const { t, pick } = useLang()
  const myRoles = ROLES.filter((r) => room.roleOwners[r] === selfId)
  const [activeRole, setActiveRole] = useState<PlayerRole>(myRoles[0] ?? 'science')

  const config = room.config
  const target = TARGETS[config.targetId]
  const platform = PLATFORMS.find((p) => p.id === config.platformId) ?? null
  const maxInstruments = platform ? platform.maxInstruments : 0

  const ownerId = room.roleOwners[activeRole]
  const ownerName = room.players.find((p) => p.id === ownerId)?.name ?? '—'
  const canEdit = ownerId === selfId

  const roleGates = report.gates.filter((g) => g.owners.includes(activeRole))
  const roleGatesPassed = roleGates.every((g) => g.passed)
  const isRoleReady = room.readyRoles[activeRole]
  const allRolesReady = ROLES.every((r) => room.readyRoles[r])

  const myUnreadyRoles = myRoles.filter((r) => !room.readyRoles[r])
  const allMyRolesGatesPassed =
    myRoles.length > 0 &&
    myRoles.every((r) => report.gates.filter((g) => g.owners.includes(r)).every((g) => g.passed))
  const showConfirmAllMine = myRoles.length > 1 && myUnreadyRoles.length > 0

  const patch = (next: Partial<MissionConfig>) => {
    if (!canEdit) return
    updateMissionConfig(room.code, next).catch(() => undefined)
  }

  const toggleInstrument = (instId: string) => {
    if (!canEdit) return
    const exists = config.instrumentIds.includes(instId)
    if (exists) {
      patch({ instrumentIds: config.instrumentIds.filter((id) => id !== instId) })
    } else if (maxInstruments === 0 || config.instrumentIds.length < maxInstruments) {
      patch({ instrumentIds: [...config.instrumentIds, instId] })
    }
  }

  const activeSynergies = SYNERGIES.filter(
    (s) => config.instrumentIds.includes(s.a) && config.instrumentIds.includes(s.b),
  )

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ROLES.map((role) => {
            const isSelected = role === activeRole
            const isMine = room.roleOwners[role] === selfId
            const ready = room.readyRoles[role]
            const rOwner = room.players.find((p) => p.id === room.roleOwners[role])?.name ?? ''
            return (
              <button
                key={role}
                type="button"
                onClick={() => setActiveRole(role)}
                className={`flex flex-col items-start rounded-md border p-2.5 text-left transition ${
                  isSelected
                    ? 'border-cyan-400 bg-cyan-950/40'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span className="truncate text-xs font-bold text-slate-100">
                    {pick(ROLE_INFO[role].name)}
                  </span>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      ready ? 'bg-emerald-400' : 'bg-slate-600'
                    }`}
                  />
                </div>
                <div className="mt-1 truncate text-[11px] text-slate-400">
                  {isMine ? `${t.you} (${rOwner})` : rOwner}
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">
                {pick(ROLE_INFO[activeRole].name)}
              </h2>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  canEdit
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {canEdit ? t.yourRoleBadge : `${t.readOnlyBadge}: ${ownerName}`}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{pick(ROLE_INFO[activeRole].description)}</p>
          </div>
        </div>

        {/* ==================== НАУКОВИЙ КЕРІВНИК ==================== */}
        {activeRole === 'science' && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300">
                <span>
                  {t.secInstruments}{' '}
                  {maxInstruments > 0 ? `${maxInstruments}) · ` : '—) · '}
                  {config.instrumentIds.length}/{maxInstruments || '—'}
                </span>
                {activeSynergies.length > 0 && (
                  <span className="text-emerald-400">
                    {t.synergyActive}: {activeSynergies.map((s) => pick(s.label)).join(', ')}
                  </span>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {INSTRUMENTS.filter(
                  (inst) =>
                    inst.targets.includes(target.id) || config.instrumentIds.includes(inst.id),
                ).map((inst) => {
                  const checked = config.instrumentIds.includes(inst.id)
                  const limitReached =
                    !checked && maxInstruments > 0 && config.instrumentIds.length >= maxInstruments
                  return (
                    <label
                      key={inst.id}
                      className={`flex cursor-pointer flex-col justify-between rounded border p-2.5 text-xs transition ${
                        checked
                          ? 'border-cyan-500/70 bg-cyan-950/30'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      } ${!canEdit || limitReached ? 'cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-slate-100">{pick(inst.name)}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canEdit || limitReached}
                          onChange={() => toggleInstrument(inst.id)}
                          className="mt-0.5 accent-cyan-500"
                        />
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-slate-400">
                        <span className="text-cyan-300">+{inst.sciencePoints} sci</span>
                        <span>{inst.massKg} kg</span>
                        <span>{inst.powerWatts} W</span>
                        <span>
                          {inst.dataGbitPerHour} {t.gbitHourUnit}
                        </span>
                        <span>{inst.costM} M$</span>
                        <span>TRL {inst.trl}</span>
                        <span>≤{inst.pointingDeg}°</span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                {t.secDutyCycle}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['eco', t.dutyEco],
                    ['normal', t.dutyNormal],
                    ['max', t.dutyMax],
                  ] as [DutyCycleId, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => patch({ dutyCycle: id })}
                    className={`rounded border px-3 py-2 text-xs font-semibold transition ${
                      config.dutyCycle === id
                        ? 'border-cyan-400 bg-cyan-600/30 text-cyan-200'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    } disabled:cursor-not-allowed`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== ІНЖЕНЕР АПАРАТА ==================== */}
        {activeRole === 'bus' && (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300">
                <span>{t.secPlatform}</span>
                {!config.platformId && (
                  <span className="text-[11px] font-normal normal-case text-amber-400">
                    {t.notSelectedLabel}
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => patch({ platformId: p.id })}
                    className={`rounded border p-2.5 text-left text-xs transition ${
                      config.platformId === p.id
                        ? 'border-cyan-400 bg-cyan-950/40'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    } disabled:cursor-not-allowed`}
                  >
                    <div className="font-semibold text-slate-100">{pick(p.name)}</div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      Max {p.maxInstruments} inst · {p.ownMassKg} kg · {p.coreWatts} W · {p.costM} M$
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300">
                <span>{t.secAdcs}</span>
                {!config.adcsId && (
                  <span className="text-[11px] font-normal normal-case text-amber-400">
                    {t.notSelectedLabel}
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {ADCS_LIST.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => patch({ adcsId: a.id })}
                    className={`rounded border p-2.5 text-left text-xs transition ${
                      config.adcsId === a.id
                        ? 'border-cyan-400 bg-cyan-950/40'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    } disabled:cursor-not-allowed`}
                  >
                    <div className="font-semibold text-slate-100">{pick(a.name)}</div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {a.pointingDeg}° · {a.massKg} kg · {a.powerWatts} W · {a.costM} M$
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300">
                <span>{t.secPanels}</span>
                {!config.panelId && (
                  <span className="text-[11px] font-normal normal-case text-amber-400">
                    {t.notSelectedLabel}
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {SOLAR_PANELS.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      patch({
                        panelId: sp.id,
                        panelAreaM2: config.panelAreaM2 > 0 ? config.panelAreaM2 : 1.0,
                      })
                    }
                    className={`rounded border p-2 text-left text-xs transition ${
                      config.panelId === sp.id
                        ? 'border-cyan-400 bg-cyan-950/40'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    } disabled:cursor-not-allowed`}
                  >
                    <div className="font-semibold text-slate-100">{pick(sp.name)}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {sp.kgPerM2} kg/m² · {sp.costMPerM2} M$/m² · TRL {sp.trl}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>{t.panelAreaLabel}</span>
                  <span className="font-bold tabular-nums text-cyan-300">
                    {config.panelAreaM2.toFixed(1)} m²
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={25}
                  step={0.5}
                  disabled={!canEdit || !config.panelId}
                  value={config.panelAreaM2}
                  onChange={(e) => patch({ panelAreaM2: Number(e.target.value) })}
                  className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                />
              </div>
            </div>

            <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300">
                <span>{t.secBattery}</span>
                {!config.batteryId && (
                  <span className="text-[11px] font-normal normal-case text-amber-400">
                    {t.notSelectedLabel}
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {BATTERIES.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      patch({
                        batteryId: b.id,
                        batteryKwh: config.batteryKwh > 0 ? config.batteryKwh : 0.2,
                      })
                    }
                    className={`rounded border p-2 text-left text-xs transition ${
                      config.batteryId === b.id
                        ? 'border-cyan-400 bg-cyan-950/40'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    } disabled:cursor-not-allowed`}
                  >
                    <div className="font-semibold text-slate-100">{pick(b.name)}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {b.costMPerKwh} M$/kWh · TRL {b.trl}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>{t.batteryCapLabel}</span>
                  <span className="font-bold tabular-nums text-cyan-300">
                    {config.batteryKwh.toFixed(2)} kWh ({(config.batteryKwh * 1000).toFixed(0)} Wh)
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.1}
                  disabled={!canEdit || !config.batteryId}
                  value={config.batteryKwh}
                  onChange={(e) => patch({ batteryKwh: Number(e.target.value) })}
                  className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                />
              </div>
            </div>

            <div className="space-y-2 rounded border border-slate-800 bg-slate-950/40 p-3 text-xs">
              <div className="font-semibold uppercase tracking-wider text-slate-300">
                {t.secBusProtection}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-slate-200">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={config.optRadHard}
                  onChange={(e) => patch({ optRadHard: e.target.checked })}
                  className="accent-cyan-500"
                />
                <span>{t.optRadHard}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-slate-200">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={config.optShield}
                  onChange={(e) => patch({ optShield: e.target.checked })}
                  className="accent-cyan-500"
                />
                <span>{t.optShield}</span>
              </label>
            </div>
          </div>
        )}

        {/* ==================== ІНЖЕНЕР ПОЛЬОТУ ==================== */}
        {activeRole === 'flight' && (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                {t.secRocket}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {ROCKETS.filter(
                  (rk) => rk.capKg[target.id] > 0 || config.rocketId === rk.id,
                ).map((rk) => {
                  const cap = rk.capKg[target.id]
                  return (
                    <button
                      key={rk.id}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => patch({ rocketId: rk.id })}
                      className={`rounded border p-2.5 text-left text-xs transition ${
                        config.rocketId === rk.id
                          ? 'border-cyan-400 bg-cyan-950/40'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      } disabled:cursor-not-allowed`}
                    >
                      <div className="flex justify-between gap-2 font-semibold text-slate-100">
                        <span>{pick(rk.name)}</span>
                        <span className="shrink-0 text-cyan-300">{cap > 0 ? `${cap} kg` : 'N/A'}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {rk.costM} M$ · Rel {(rk.reliability * 100).toFixed(0)}% · TRL {rk.trl}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300">
                <span>
                  {t.secEngine}{' '}
                  <span className="font-normal normal-case text-slate-400">
                    ({t.optionalLabel})
                  </span>
                </span>
                {!config.engineId && (
                  <span className="text-[11px] font-normal normal-case text-slate-400">
                    {t.notSelectedLabel}
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {ENGINES.map((en) => {
                  const selected = config.engineId === en.id
                  return (
                    <button
                      key={en.id}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => patch({ engineId: selected ? '' : en.id })}
                      className={`rounded border p-2.5 text-left text-xs transition ${
                        selected
                          ? 'border-cyan-400 bg-cyan-950/40'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      } disabled:cursor-not-allowed`}
                    >
                      <div className="flex justify-between gap-2 font-semibold text-slate-100">
                        <span>{pick(en.name)}</span>
                        <span className="shrink-0 text-cyan-300">
                          ~{en.lifeYears} {t.yearsUnit}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {en.massKg} kg · {en.powerWatts} W · {en.costM} M$
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-800 bg-slate-950/40 p-3 text-xs text-amber-200">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={config.acceptHighRisk}
                onChange={(e) => patch({ acceptHighRisk: e.target.checked })}
                className="accent-amber-500"
              />
              <span>{t.acceptHighRiskLabel}</span>
            </label>
          </div>
        )}

        {/* ==================== ЗВ'ЯЗКІВЕЦЬ ==================== */}
        {activeRole === 'comms' && (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300">
                <span>{t.secRadio}</span>
                {!config.radioId && (
                  <span className="text-[11px] font-normal normal-case text-amber-400">
                    {t.notSelectedLabel}
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {RADIOS.filter(
                  (rd) => rd.rateGbitPerHour[target.id] > 0 || config.radioId === rd.id,
                ).map((rd) => {
                  const rate = rd.rateGbitPerHour[target.id]
                  return (
                    <button
                      key={rd.id}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => patch({ radioId: rd.id })}
                      className={`rounded border p-2.5 text-left text-xs transition ${
                        config.radioId === rd.id
                          ? 'border-cyan-400 bg-cyan-950/40'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      } disabled:cursor-not-allowed`}
                    >
                      <div className="flex justify-between gap-2 font-semibold text-slate-100">
                        <span>{pick(rd.name)}</span>
                        <span className="shrink-0 text-cyan-300">
                          {rate > 0 ? `${rate} ${t.gbitHourUnit}` : 'N/A'}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {rd.massKg} kg · {rd.powerWatts} W · {rd.costM} M$ · ≤{rd.pointingDeg}°
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300">
                <span>{t.secMemory}</span>
                {!config.memoryId && (
                  <span className="text-[11px] font-normal normal-case text-amber-400">
                    {t.notSelectedLabel}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MEMORIES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => patch({ memoryId: m.id })}
                    className={`rounded border p-2 text-left text-xs transition ${
                      config.memoryId === m.id
                        ? 'border-cyan-400 bg-cyan-950/40'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    } disabled:cursor-not-allowed`}
                  >
                    <div className="font-semibold text-slate-100">{pick(m.name)}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {m.massKg} kg · {m.costM} M$
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300">
                  <span>
                    {t.secProcessor}{' '}
                    <span className="font-normal normal-case text-slate-400">
                      ({t.optionalLabel})
                    </span>
                  </span>
                </div>
                <div className="space-y-1.5">
                  {PROCESSORS.map((pr) => {
                    const selected = config.processorId === pr.id
                    return (
                      <button
                        key={pr.id}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => patch({ processorId: selected ? '' : pr.id })}
                        className={`flex w-full items-center justify-between rounded border px-2.5 py-2 text-xs transition ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/40'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        } disabled:cursor-not-allowed`}
                      >
                        <span className="font-medium text-slate-100">{pick(pr.name)}</span>
                        <span className="text-[11px] text-slate-400">
                          {pr.massKg}kg · {pr.costM}M$
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300">
                  <span>{t.secStations}</span>
                  {config.groundStations === 0 && (
                    <span className="text-[11px] font-normal normal-case text-amber-400">
                      0 / 3
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {([1, 2, 3] as GroundStationCount[]).map((cnt) => {
                    const selected = config.groundStations === cnt
                    return (
                      <button
                        key={cnt}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => patch({ groundStations: selected ? 0 : cnt })}
                        className={`flex w-full items-center justify-between rounded border px-2.5 py-2 text-xs transition ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/40'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        } disabled:cursor-not-allowed`}
                      >
                        <span className="font-medium text-slate-100">
                          {cnt} · {t.groundStationLabel}
                        </span>
                        <span className="text-[11px] text-cyan-300">
                          {GROUND_STATION_COSTS_M[cnt]} M$
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded border border-slate-800 bg-slate-950/40 p-3 text-xs">
              <div className="font-semibold uppercase tracking-wider text-slate-300">
                {t.secCommsOptions}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-slate-200">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={config.optEncryption}
                  onChange={(e) => patch({ optEncryption: e.target.checked })}
                  className="accent-cyan-500"
                />
                <span>{t.optEncryption}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-slate-200">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={config.optRedundancy}
                  onChange={(e) => patch({ optRedundancy: e.target.checked })}
                  className="accent-cyan-500"
                />
                <span>{t.optRedundancy}</span>
              </label>
            </div>
          </div>
        )}

        {canEdit && (
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
            <div className="text-xs text-slate-400">
              {pick(ROLE_INFO[activeRole].name)}:{' '}
              <span className={isRoleReady ? 'font-bold text-emerald-400' : 'text-slate-300'}>
                {isRoleReady
                  ? t.roleGoReady
                  : `${roleGates.filter((g) => g.passed).length}/${roleGates.length} Gates`}
              </span>
            </div>
            <button
              type="button"
              disabled={!roleGatesPassed && !isRoleReady}
              onClick={() => {
                setRoleReady(room.code, activeRole, !isRoleReady).catch(() => undefined)
              }}
              className={`rounded px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                isRoleReady
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : roleGatesPassed
                    ? 'bg-cyan-600 text-white hover:bg-cyan-500'
                    : 'cursor-not-allowed bg-slate-800 text-slate-500'
              }`}
            >
              {isRoleReady ? t.revokeGoBtn : t.confirmGoBtn}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-cyan-400">
            {t.gatesTitle}
          </h3>
          <div className="space-y-1.5">
            {report.gates.map((gate) => (
              <div
                key={gate.id}
                className={`rounded border px-2.5 py-1.5 text-xs ${
                  gate.passed
                    ? 'border-emerald-500/30 bg-emerald-950/15 text-slate-200'
                    : 'border-rose-500/50 bg-rose-950/25 text-rose-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-semibold">
                  <span>
                    {gate.passed ? '✓ ' : '✕ '}
                    {pick(gate.title)}
                  </span>
                  <span className="tabular-nums text-[11px]">{pick(gate.summary)}</span>
                </div>
                {!gate.passed && gate.advice && (
                  <p className="mt-1 text-[11px] text-rose-300/90">{pick(gate.advice)}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2.5 border-t border-slate-800 pt-3">
          <div className="grid grid-cols-2 gap-1.5">
            {ROLES.map((r) => {
              const rReady = room.readyRoles[r]
              return (
                <div
                  key={r}
                  className={`flex items-center justify-between rounded border px-2 py-1 text-[11px] ${
                    rReady
                      ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                      : 'border-slate-800 bg-slate-950/50 text-slate-400'
                  }`}
                >
                  <span className="truncate">{pick(ROLE_INFO[r].name)}</span>
                  <span className="font-bold">{rReady ? 'GO' : '—'}</span>
                </div>
              )
            })}
          </div>

          {showConfirmAllMine && (
            <button
              type="button"
              disabled={!allMyRolesGatesPassed}
              onClick={() => {
                Promise.all(myUnreadyRoles.map((r) => setRoleReady(room.code, r, true))).catch(
                  () => undefined,
                )
              }}
              className="w-full rounded border border-cyan-500/50 bg-cyan-950/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-900/50 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-600"
            >
              {t.confirmAllMyGoBtn} ({myRoles.length})
            </button>
          )}

          <button
            type="button"
            disabled={!report.allGatesPassed || !allRolesReady}
            onClick={onLaunch}
            className="w-full rounded-md bg-emerald-500 px-4 py-3 text-sm font-extrabold uppercase tracking-wider text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
          >
            {t.launchMissionBtn}
          </button>

          {(!report.allGatesPassed || !allRolesReady) && (
            <p className="text-center text-[11px] text-slate-400">{t.launchBlockedHint}</p>
          )}
        </div>
      </div>
    </div>
  )
}