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
  const budBad = report.budgetUsedM > report.budgetMaxM
  const budStatus = budBad ? 'bad' : budRatio > 0.9 ? 'warn' : 'ok'

  // 2. Вага апарата vs ракета та корпус
  const massRatio = report.rocketLimitKg > 0 ? report.spacecraftMassKg / report.rocketLimitKg : 1.5
  const massBad =
    report.rocketLimitKg <= 0 ||
    report.spacecraftMassKg <= 0 ||
    report.spacecraftMassKg > report.rocketLimitKg ||
    !report.busCompatible
  const massStatus = massBad ? 'bad' : massRatio > 0.9 ? 'warn' : 'ok'

  // 3. Швидкість запису інформації (Гбіт/год)
  const recRatio = report.dataRecGbitHour > 0 ? Math.min(1, report.dataRecGbitHour / 30) : 0
  const recBad = report.dataRecGbitHour <= 0
  const recStatus = recBad ? 'bad' : 'ok'

  // 4. Швидкість передачі на Землю (Гбіт/год) + буфер пам'яті + ADCS
  const downBad =
    report.contactHoursPerDay <= 0 ||
    report.dataDownlinkGbitHour <= 0 ||
    report.dataDownlinkGbitDay < report.dataGenGbitDay ||
    report.memoryCapacityGbit <= 0 ||
    report.memoryCapacityGbit < report.memoryRequiredGbit ||
    !report.adcsCompatible
  const downRatio =
    report.dataGenGbitDay > 0
      ? Math.min(1, report.dataDownlinkGbitDay / report.dataGenGbitDay)
      : report.dataDownlinkGbitHour > 0
        ? 1
        : 0
  const downStatus = downBad ? 'bad' : downRatio < 1.1 ? 'warn' : 'ok'

  // 5. Потужність пристроїв (Вт)
  const pwrRatio =
    report.powerGenWatts > 0 ? report.powerNeedWatts / report.powerGenWatts : 1.5
  const pwrBad = report.powerGenWatts <= 0 || report.powerGenWatts < report.powerNeedWatts
  const pwrStatus = pwrBad ? 'bad' : pwrRatio > 0.9 ? 'warn' : 'ok'

  // 6. Ємність батареї (Вт·год)
  const batRatio =
    report.batteryCapacityWh > 0 ? report.batteryRequiredWh / report.batteryCapacityWh : 1.5
  const batBad = report.batteryCapacityWh <= 0 || report.batteryCapacityWh < report.batteryRequiredWh
  const batStatus = batBad ? 'bad' : batRatio > 0.9 ? 'warn' : 'ok'

  // 7. Очікувана наука
  const sciRatio = report.scienceRef > 0 ? report.scienceExpected / report.scienceRef : 0
  const sciBad = report.scienceInstalled < report.scienceMin
  const sciStatus = sciBad
    ? 'bad'
    : report.scienceInstalled < report.scienceMin * 1.15
      ? 'warn'
      : 'ok'

  // 8. Ризик провалу
  const riskRatio = report.failProbMax > 0 ? report.failProbTotal / report.failProbMax : 1
  const riskBad = report.metricIssues.some((m) => m.en === 'Failure Risk')
  const riskStatus = riskBad
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
            : t.busNotSelectedLabel
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
        sub={`${report.dataDownlinkGbitDay.toFixed(0)} / ${report.dataGenGbitDay.toFixed(0)} Gb/d`}
        ratio={downRatio}
        status={downStatus}
      />
      <MetricCard
        label={t.metricPower}
        value={`${report.powerGenWatts.toFixed(0)} / ${report.powerNeedWatts.toFixed(0)} W`}
        sub="Gen / Load"
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