import { TARGETS } from '../engine/catalog'
import { useLang } from '../i18n/LangContext'
import type { MissionConfig, MissionReport } from '../types/game'

interface OrbitVisualizerProps {
  config: MissionConfig
  report: MissionReport
}

export default function OrbitVisualizer({ config, report }: OrbitVisualizerProps) {
  const { t, pick } = useLang()
  const target = TARGETS[config.targetId]

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
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

      {/* Очікувані загрози цілі */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {t.threatsTitle}
        </div>
        {report.threatResults.map((tr) => (
          <div
            key={tr.threat.id}
            className={`rounded border px-2.5 py-2 text-xs ${
              tr.mitigated
                ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
                : 'border-amber-500/40 bg-amber-950/20 text-amber-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2 font-semibold">
              <span>{pick(tr.threat.name)}</span>
              <span className="shrink-0 rounded bg-slate-950/70 px-1.5 py-0.5 text-[10px]">
                {tr.mitigated ? t.protectedTag : t.vulnerableTag}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-300/90">{pick(tr.threat.mitigationHint)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}