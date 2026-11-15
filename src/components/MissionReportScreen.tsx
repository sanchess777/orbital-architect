import { TARGETS } from '../engine/catalog'
import { useLang } from '../i18n/LangContext'
import { returnToDesign } from '../multiplayer/roomApi'
import type { MissionConfig, MissionPhaseFail, MissionReport } from '../types/game'

interface MissionReportScreenProps {
  roomCode: string
  config: MissionConfig
  report: MissionReport
}

const PHASE_ORDER: MissionPhaseFail[] = ['launch', 'transit', 'ins', 'ops']

export default function MissionReportScreen({
  roomCode,
  config,
  report,
}: MissionReportScreenProps) {
  const { t, pick } = useLang()
  const target = TARGETS[config.targetId]

  const bannerStyle =
    report.outcome === 'success'
      ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-300'
      : report.outcome === 'partial'
        ? 'border-amber-500/60 bg-amber-950/30 text-amber-300'
        : 'border-rose-500/60 bg-rose-950/30 text-rose-300'

  const outcomeTitle =
    report.outcome === 'success'
      ? t.outcomeSuccess
      : report.outcome === 'partial'
        ? t.outcomePartial
        : report.outcome === 'failed'
          ? t.outcomeFailed
          : t.outcomeBlocked

  const medalLabel =
    report.medal === 'gold'
      ? t.medalGold
      : report.medal === 'silver'
        ? t.medalSilver
        : report.medal === 'bronze'
          ? t.medalBronze
          : t.medalExperimental

  const phaseLabels: Record<MissionPhaseFail, string> = {
    launch: t.phaseLaunch,
    transit: t.phaseTransit,
    ins: t.phaseIns,
    ops: t.phaseOps,
  }

  const failedIdx = report.failedPhase ? PHASE_ORDER.indexOf(report.failedPhase) : -1

  // Частки балів для наочної розбивки (500 / 300 / 200)
  const sciPts = Math.round(500 * Math.min(1, report.scienceExpected / target.sRef))
  const relPts = Math.round(300 * Math.max(0, 1 - report.failProbTotal))
  const lifePts = Math.round(200 * Math.min(1, report.lifeMonths / target.tNomMonths))

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-5 ${bannerStyle}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-80">
              {t.reportTitle} · {pick(target.name)}
            </div>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight">{outcomeTitle}</h2>
            {report.failureReason && (
              <p className="mt-1.5 text-sm text-rose-200">{pick(report.failureReason)}</p>
            )}
          </div>

          <div className="flex items-center gap-4 rounded-lg border border-slate-700/60 bg-slate-950/70 px-4 py-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">
                {t.finalScoreLabel}
              </div>
              <div className="text-3xl font-black tabular-nums text-cyan-300">
                {report.score} <span className="text-sm font-normal text-slate-400">/ 1000</span>
              </div>
            </div>
            <div className="rounded bg-cyan-500/20 px-2.5 py-1 text-xs font-bold text-cyan-200">
              {medalLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Етапи польоту та перевірка ризиків */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-cyan-400">
          {t.flightPhasesTitle}
        </h3>
        <div className="grid gap-2 sm:grid-cols-4">
          {PHASE_ORDER.map((ph, idx) => {
            const probPct = (report.phaseProbs[ph] * 100).toFixed(1)
            const isFailedHere = failedIdx === idx
            const isSkipped = failedIdx !== -1 && idx > failedIdx
            const isBlocked = report.outcome === 'blocked'

            const cardClass =
              isBlocked || isSkipped
                ? 'border-slate-800 bg-slate-950/40 text-slate-500'
                : isFailedHere
                  ? 'border-rose-500/60 bg-rose-950/30 text-rose-200'
                  : 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'

            return (
              <div key={ph} className={`rounded border p-3 text-xs ${cardClass}`}>
                <div className="flex items-center justify-between font-bold">
                  <span>{phaseLabels[ph]}</span>
                  <span>
                    {isBlocked || isSkipped ? '—' : isFailedHere ? '✕' : '✓'}
                  </span>
                </div>
                <div className="mt-1 text-[11px] opacity-80">
                  {t.phaseRiskLabel}: {probPct}%
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Ключові підсумки + Аналог NASA + Розбивка балів */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400">
            {t.nasaAnalogLabel}
          </div>
          <div className="mt-1 text-sm font-bold text-cyan-300">{pick(target.analog)}</div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400">
            {t.deliveredScienceLabel}
          </div>
          <div className="mt-1 text-base font-bold tabular-nums text-slate-100">
            {report.outcome === 'failed' ? '0.0' : report.sciencePotential.toFixed(1)} /{' '}
            {report.scienceRef} pts
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400">
            {t.achievedLifeLabel}
          </div>
          <div className="mt-1 text-base font-bold tabular-nums text-slate-100">
            {report.outcome === 'failed' ? '0' : report.lifeMonths.toFixed(1)} /{' '}
            {report.nominalMonths} {t.monthsUnit}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-xs">
          <div className="uppercase tracking-wider text-slate-400">{t.scoreBreakdownTitle}</div>
          <div className="mt-1.5 space-y-1 tabular-nums text-slate-200">
            <div className="flex justify-between">
              <span>{t.scoreSciPart}:</span>
              <span className="font-semibold text-cyan-300">{sciPts} / 500</span>
            </div>
            <div className="flex justify-between">
              <span>{t.scoreRelPart}:</span>
              <span className="font-semibold text-cyan-300">{relPts} / 300</span>
            </div>
            <div className="flex justify-between">
              <span>{t.scoreLifePart}:</span>
              <span className="font-semibold text-cyan-300">{lifePts} / 200</span>
            </div>
          </div>
        </div>
      </div>

      {/* Вплив середовища та загроз */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-cyan-400">
          {t.hazardOutcomeTitle}
        </h3>
        <div className="grid gap-2 md:grid-cols-2">
          {report.threatResults.map((tr) => (
            <div
              key={tr.threat.id}
              className={`rounded border p-3 text-xs ${
                tr.mitigated
                  ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
                  : 'border-amber-500/50 bg-amber-950/25 text-amber-200'
              }`}
            >
              <div className="font-bold">{pick(tr.threat.name)}</div>
              <div className="mt-1 text-slate-200">{pick(tr.detail)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Журнал телеметрії польоту */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-4">
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-cyan-400">
          {t.telemetryLogTitle}
        </h3>
        <div className="space-y-1.5 font-mono text-xs text-slate-300">
          {report.telemetryLog.map((entry, idx) => (
            <div key={idx} className="border-l-2 border-cyan-500/40 pl-2.5">
              {pick(entry)}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            returnToDesign(roomCode).catch(() => undefined)
          }}
          className="rounded-md bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-500"
        >
          {t.modifyDesignBtn}
        </button>
      </div>
    </div>
  )
}