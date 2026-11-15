import { TARGETS } from '../engine/catalog'
import { useLang } from '../i18n/LangContext'
import type { MissionConfig, MissionReport } from '../types/game'

interface OrbitVisualizerProps {
  config: MissionConfig
  report: MissionReport
  onLaunch: () => void
}

export default function OrbitVisualizer({ config, report, onLaunch }: OrbitVisualizerProps) {
  const { t, pick } = useLang()
  const target = TARGETS[config.targetId]

  const memOk =
    report.memoryCapacityGbit > 0 && report.memoryCapacityGbit >= report.memoryRequiredGbit
  const dailyDataOk =
    report.contactHoursPerDay > 0 &&
    report.dataDownlinkGbitHour > 0 &&
    report.dataDownlinkGbitDay >= report.dataGenGbitDay

  return (
    <div className="flex flex-col justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            {t.orbitSchemaTitle}
          </h3>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
            {pick(target.injectionOrbit)}
          </span>
        </div>

        {/* Ключові часові параметри орбіти та зв'язку */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded border border-slate-800 bg-slate-950/50 px-2.5 py-2">
            <div className="text-slate-400">{t.maxEclipseLabel}</div>
            <div className="mt-0.5 font-semibold text-amber-300">
              {target.maxEclipseHours} {t.hoursUnit}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950/50 px-2.5 py-2">
            <div className="text-slate-400">{t.contactHoursLabel}</div>
            <div className="mt-0.5 font-semibold text-cyan-300">
              {report.contactHoursPerDay.toFixed(1)} {t.hoursPerDayUnit}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950/50 px-2.5 py-2">
            <div className="text-slate-400">{t.maxBlackoutLabel}</div>
            <div className="mt-0.5 font-semibold text-slate-200">
              {report.maxBlackoutHours} {t.hoursUnit}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950/50 px-2.5 py-2">
            <div className="text-slate-400">{t.signalDelayLabel}</div>
            <div className="mt-0.5 font-semibold text-slate-200">{pick(target.signalDelay)}</div>
          </div>
        </div>

        {/* Приховані метрики систем та буферів */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {t.hiddenMetricsTitle}
          </div>

          <div className="space-y-1.5 text-xs">
            <div
              className={`flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 ${
                report.busCompatible
                  ? 'border-slate-800 bg-slate-950/50 text-slate-200'
                  : 'border-rose-500/50 bg-rose-950/20 text-rose-200'
              }`}
            >
              <span className="text-slate-400">{t.busSlotsLabel}</span>
              <span className="font-semibold tabular-nums">
                {report.platformName
                  ? `${report.instrumentsCount}/${report.maxInstruments} · ${Math.round(report.spacecraftMassKg)} kg`
                  : t.notSelectedLabel}
              </span>
            </div>

            <div
              className={`flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 ${
                report.adcsSelected
                  ? 'border-slate-800 bg-slate-950/50 text-slate-200'
                  : 'border-rose-500/50 bg-rose-950/20 text-rose-200'
              }`}
            >
              <span className="text-slate-400">{t.adcsBonusLabel}</span>
              <span className="font-semibold tabular-nums">
                {report.adcsSelected ? `+${report.adcsScienceBonus} sci` : t.notSelectedLabel}
              </span>
            </div>

            <div
              className={`flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 ${
                memOk
                  ? 'border-slate-800 bg-slate-950/50 text-slate-200'
                  : 'border-rose-500/50 bg-rose-950/20 text-rose-200'
              }`}
            >
              <span className="text-slate-400">{t.memoryBufferLabel}</span>
              <span className="font-semibold tabular-nums">
                {report.memoryCapacityGbit} / {Math.ceil(report.memoryRequiredGbit)} Gb
              </span>
            </div>

            <div
              className={`flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 ${
                dailyDataOk
                  ? 'border-slate-800 bg-slate-950/50 text-slate-200'
                  : 'border-rose-500/50 bg-rose-950/20 text-rose-200'
              }`}
            >
              <span className="text-slate-400">{t.dailyDataBalanceLabel}</span>
              <span className="font-semibold tabular-nums">
                {report.dataDownlinkGbitDay.toFixed(0)} / {report.dataGenGbitDay.toFixed(0)} Gb/d
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/50 px-2.5 py-1.5 text-slate-200">
              <span className="text-slate-400">{t.propulsionLifeLabel}</span>
              <span className="font-semibold tabular-nums">
                {report.lifeMonths} {t.monthsUnit}
                {report.lifeBonusPct > 0 ? ` (+${report.lifeBonusPct}% sci)` : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Кнопка запуску місії внизу правої панелі */}
      <div className="space-y-2 border-t border-slate-800 pt-3">
        <button
          type="button"
          disabled={!report.canLaunch}
          onClick={onLaunch}
          className="w-full rounded-md bg-emerald-500 px-4 py-3 text-sm font-extrabold uppercase tracking-wider text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
        >
          {t.launchMissionBtn}
        </button>

        {!report.canLaunch && (
          <p className="text-center text-[11px] text-rose-300/90">
            {t.launchBlockedHint}: {report.metricIssues.map((m) => pick(m)).join(', ')}
          </p>
        )}
      </div>
    </div>
  )
}