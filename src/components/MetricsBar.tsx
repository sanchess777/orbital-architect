import { useLang } from '../i18n/LangContext'
import type { MissionReport } from '../types/game'

interface MetricsBarProps {
  report: MissionReport
}

interface MetricCardProps {
  label: string
  value: string
  sub: string
  ratio: number
  status: 'ok' | 'warn' | 'bad'
}

function MetricCard({ label, value, sub, ratio, status }: MetricCardProps) {
  const barColor =
    status === 'bad' ? 'bg-rose-500' : status === 'warn' ? 'bg-amber-400' : 'bg-cyan-400'
  const borderColor =
    status === 'bad'
      ? 'border-rose-500/60 bg-rose-950/20'
      : status === 'warn'
        ? 'border-amber-400/50 bg-amber-950/20'
        : 'border-slate-800 bg-slate-900/70'
  const textColor =
    status === 'bad' ? 'text-rose-300' : status === 'warn' ? 'text-amber-300' : 'text-slate-100'

  const widthPct = Math.max(4, Math.min(100, Math.round(ratio * 100)))

  return (
    <div className={`rounded-lg border p-2.5 transition-colors ${borderColor}`}>
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-slate-400">
        <span>{label}</span>
      </div>
      <div className={`mt-1 text-sm font-bold tabular-nums ${textColor}`}>{value}</div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-all duration-300 ${barColor}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <div className="mt-1 truncate text-[11px] tabular-nums text-slate-400">{sub}</div>
    </div>
  )
}

export default function MetricsBar({ report }: MetricsBarProps) {
  const { t } = useLang()

  // 1. Бюджет
  const budRatio = report.budgetMaxM > 0 ? report.budgetUsedM / report.budgetMaxM : 1
  const budStatus = budRatio > 1 ? 'bad' : budRatio > 0.9 ? 'warn' : 'ok'

  // 2. Вага апарата vs ракета
  const massRatio = report.rocketLimitKg > 0 ? report.spacecraftMassKg / report.rocketLimitKg : 1.5
  const g1Ok = report.gates.find((g) => g.id === 'G1')?.passed ?? false
  const massStatus = !g1Ok ? 'bad' : massRatio > 0.9 ? 'warn' : 'ok'

  // 3. Швидкість запису інформації (Гбіт/год)
  const recRatio = report.dataRecGbitHour > 0 ? Math.min(1, report.dataRecGbitHour / 30) : 0
  const recStatus = report.dataRecGbitHour <= 0 ? 'bad' : 'ok'

  // 4. Швидкість передачі на Землю (Гбіт/год)
  const g5Ok = report.gates.find((g) => g.id === 'G5')?.passed ?? false
  const downRatio =
    report.dataGenGbitDay > 0
      ? Math.min(1, report.dataDownlinkGbitDay / report.dataGenGbitDay)
      : report.dataDownlinkGbitHour > 0
        ? 1
        : 0
  const downStatus = !g5Ok ? 'bad' : downRatio < 1.1 ? 'warn' : 'ok'

  // 5. Потужність пристроїв (Вт)
  const pwrRatio =
    report.powerGenWatts > 0 ? report.powerNeedWatts / report.powerGenWatts : 1.5
  const g2Ok = report.gates.find((g) => g.id === 'G2')?.passed ?? false
  const pwrStatus = !g2Ok ? 'bad' : pwrRatio > 0.9 ? 'warn' : 'ok'

  // 6. Ємність батареї (Вт·год)
  const batRatio =
    report.batteryCapacityWh > 0 ? report.batteryRequiredWh / report.batteryCapacityWh : 1.5
  const g3Ok = report.gates.find((g) => g.id === 'G3')?.passed ?? false
  const batStatus = !g3Ok ? 'bad' : batRatio > 0.9 ? 'warn' : 'ok'

  // 7. Очікувана наука
  const sciRatio = report.scienceRef > 0 ? report.scienceExpected / report.scienceRef : 0
  const sciStatus =
    report.scienceInstalled < report.scienceMin
      ? 'bad'
      : report.scienceInstalled < report.scienceMin * 1.15
        ? 'warn'
        : 'ok'

  // 8. Ризик провалу
  const riskRatio = report.failProbMax > 0 ? report.failProbTotal / report.failProbMax : 1
  const riskStatus =
    report.failProbTotal > report.failProbMax
      ? 'bad'
      : report.failProbTotal > report.failProbMax * 0.85
        ? 'warn'
        : 'ok'

  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
      <MetricCard
        label={t.metricBudget}
        value={`${report.budgetUsedM.toFixed(0)} / ${report.budgetMaxM.toFixed(0)} M$`}
        sub={`${t.reserveLabel}: ${(report.budgetReserveFrac * 100).toFixed(0)}%`}
        ratio={budRatio}
        status={budStatus}
      />
      <MetricCard
        label={t.metricMass}
        value={`${report.spacecraftMassKg.toFixed(0)} / ${report.rocketLimitKg.toFixed(0)} kg`}
        sub={
          report.dryMassLimitKg > 0
            ? `Bus max: ${report.dryMassLimitKg} kg`
            : t.notSelectedLabel
        }
        ratio={massRatio}
        status={massStatus}
      />
      <MetricCard
        label={t.metricDataRec}
        value={`${report.dataRecGbitHour.toFixed(1)} ${t.gbitHourUnit}`}
        sub={`${report.dataGenGbitDay.toFixed(0)} Gb/24h`}
        ratio={recRatio}
        status={recStatus}
      />
      <MetricCard
        label={t.metricDataDown}
        value={`${report.dataDownlinkGbitHour.toFixed(1)} ${t.gbitHourUnit}`}
        sub={`Mem: ${report.memoryCapacityGbit}/${Math.ceil(report.memoryRequiredGbit)} Gb`}
        ratio={downRatio}
        status={downStatus}
      />
      <MetricCard
        label={t.metricPower}
        value={`${report.powerGenWatts.toFixed(0)} / ${report.powerNeedWatts.toFixed(0)} W`}
        sub={`Gen / Load`}
        ratio={pwrRatio}
        status={pwrStatus}
      />
      <MetricCard
        label={t.metricBattery}
        value={`${report.batteryCapacityWh.toFixed(0)} Wh`}
        sub={`Req: ${Math.ceil(report.batteryRequiredWh)} Wh`}
        ratio={batRatio}
        status={batStatus}
      />
      <MetricCard
        label={t.metricScience}
        value={`${report.scienceExpected.toFixed(1)} pts`}
        sub={`Inst: ${report.scienceInstalled.toFixed(0)} (min ${report.scienceMin})`}
        ratio={sciRatio}
        status={sciStatus}
      />
      <MetricCard
        label={t.metricRisk}
        value={`${(report.failProbTotal * 100).toFixed(1)}%`}
        sub={`Max: ${(report.failProbMax * 100).toFixed(0)}%`}
        ratio={riskRatio}
        status={riskStatus}
      />
    </section>
  )
}