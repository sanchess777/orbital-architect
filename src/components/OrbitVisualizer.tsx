import { useEffect, useState } from 'react'
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
  const [angle, setAngle] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setAngle((prev) => (prev + 1.8) % 360)
    }, 50)
    return () => window.clearInterval(id)
  }, [])

  // Кольори й радіус орбіти залежно від цілі
  const planetStyle =
    target.id === 'mars'
      ? { fill: '#c2410c', stroke: '#fb923c', r: 34, orbitR: 84 }
      : target.id === 'moon'
        ? { fill: '#64748b', stroke: '#cbd5e1', r: 30, orbitR: 80 }
        : target.id === 'geo'
          ? { fill: '#0284c7', stroke: '#38bdf8', r: 24, orbitR: 98 }
          : { fill: '#0369a1', stroke: '#22d3ee', r: 38, orbitR: 76 }

  const cx = 140
  const cy = 120
  const rad = (angle * Math.PI) / 180
  const satX = cx + planetStyle.orbitR * Math.cos(rad)
  const satY = cy + planetStyle.orbitR * Math.sin(rad)

  // Перевірка, чи супутник зараз у тіні праворуч від планети
  const eclipseHalfAngle = (target.eclipseMin / target.orbitPeriodMin) * Math.PI
  const normAngle = ((angle % 360) + 360) % 360
  const inEclipse =
    normAngle < (eclipseHalfAngle * 180) / Math.PI ||
    normAngle > 360 - (eclipseHalfAngle * 180) / Math.PI

  // Кути наземних станцій (1, 2 або 3)
  const stationAngles =
    config.groundStations === 1 ? [180] : config.groundStations === 2 ? [140, 220] : [125, 180, 235]

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

      {/* SVG-схема орбіти */}
      <div className="relative flex items-center justify-center rounded-md border border-slate-800/80 bg-slate-950/90 py-2">
        <svg viewBox="0 0 280 240" className="h-52 w-full max-w-[300px]">
          <defs>
            <linearGradient id="shadowGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#020617" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* Сонячні промені зліва */}
          <line x1="12" y1="40" x2="48" y2="40" stroke="#facc15" strokeOpacity="0.35" strokeDasharray="3 3" />
          <line x1="12" y1="120" x2="48" y2="120" stroke="#facc15" strokeOpacity="0.35" strokeDasharray="3 3" />
          <line x1="12" y1="200" x2="48" y2="200" stroke="#facc15" strokeOpacity="0.35" strokeDasharray="3 3" />
          <circle cx="14" cy="120" r="6" fill="#facc15" fillOpacity="0.7" />

          {/* Сектор тіні планети праворуч */}
          <rect
            x={cx}
            y={cy - planetStyle.r}
            width={130}
            height={planetStyle.r * 2}
            fill="url(#shadowGrad)"
          />

          {/* Конуси зв'язку наземних станцій */}
          {stationAngles.map((deg) => {
            const a1 = ((deg - 18) * Math.PI) / 180
            const a2 = ((deg + 18) * Math.PI) / 180
            const x1 = cx + planetStyle.orbitR * Math.cos(a1)
            const y1 = cy + planetStyle.orbitR * Math.sin(a1)
            const x2 = cx + planetStyle.orbitR * Math.cos(a2)
            const y2 = cy + planetStyle.orbitR * Math.sin(a2)
            return (
              <polygon
                key={deg}
                points={`${cx},${cy} ${x1},${y1} ${x2},${y2}`}
                fill="#22d3ee"
                fillOpacity="0.14"
                stroke="#22d3ee"
                strokeOpacity="0.35"
                strokeWidth="0.8"
              />
            )
          })}

          {/* Орбіта */}
          <circle
            cx={cx}
            cy={cy}
            r={planetStyle.orbitR}
            fill="none"
            stroke="#38bdf8"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Планета */}
          <circle
            cx={cx}
            cy={cy}
            r={planetStyle.r}
            fill={planetStyle.fill}
            stroke={planetStyle.stroke}
            strokeWidth="1.5"
          />

          {/* Супутник */}
          <g transform={`translate(${satX}, ${satY})`}>
            <rect x="-8" y="-2" width="16" height="4" fill="#38bdf8" />
            <circle r="3.5" fill={inEclipse ? '#f59e0b' : '#f8fafc'} />
          </g>
        </svg>

        <div className="absolute bottom-2 left-2.5 flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            {t.eclipseZone}: {target.eclipseMin}m
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
            {t.groundCoverage}: {config.groundStations} st.
          </span>
        </div>
      </div>

      {/* Телеметрія орбіти */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-slate-800 bg-slate-950/50 px-2.5 py-1.5">
          <div className="text-slate-400">{t.signalDelayLabel}</div>
          <div className="font-semibold text-slate-200">{pick(target.signalDelay)}</div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/50 px-2.5 py-1.5">
          <div className="text-slate-400">{t.orbitalPeriodLabel}</div>
          <div className="font-semibold text-slate-200">{target.orbitPeriodMin} min</div>
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