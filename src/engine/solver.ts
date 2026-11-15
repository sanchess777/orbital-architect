import type {
  LocalizedText,
  MedalTier,
  MissionConfig,
  MissionOutcome,
  MissionPhaseFail,
  MissionReport,
  ThreatResult,
} from '../types/game'
import {
  ADCS_LIST,
  BATTERIES,
  DUTY_CYCLE_FACTOR,
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
} from './catalog'

/** Детермінований генератор псевдовипадкових чисел Mulberry32 */
function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(baseSeed: number, attempt: number, salt: number): number {
  let h = (baseSeed ^ (attempt * 2654435761) ^ (salt * 1597334677)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

function annualFailProb(trl: number): number {
  return 0.004 * Math.pow(1.6, 9 - trl)
}

export function solveMission(
  config: MissionConfig,
  seed: number,
  attempt: number
): MissionReport {
  const target = TARGETS[config.targetId]
  const platform = PLATFORMS.find((p) => p.id === config.platformId) ?? null
  const adcs = ADCS_LIST.find((a) => a.id === config.adcsId) ?? null
  const panel = SOLAR_PANELS.find((p) => p.id === config.panelId) ?? null
  const battery = BATTERIES.find((b) => b.id === config.batteryId) ?? null
  const rocket =
    ROCKETS.find((r) => r.id === config.rocketId && r.targets.includes(config.targetId)) ??
    ROCKETS.find((r) => r.targets.includes(config.targetId)) ??
    null
  const engine = ENGINES.find((e) => e.id === config.engineId) ?? null
  const radio =
    RADIOS.find((r) => r.id === config.radioId && r.targets.includes(config.targetId)) ?? null
  const memory = MEMORIES.find((m) => m.id === config.memoryId) ?? null
  const processor = PROCESSORS.find((p) => p.id === config.processorId) ?? null

  const validInstruments = INSTRUMENTS.filter(
    (inst) => config.instrumentIds.includes(inst.id) && inst.targets.includes(config.targetId)
  )
  const duty = DUTY_CYCLE_FACTOR[config.dutyCycle] ?? 1.0

  /* ==================== 1. ВАГА АПАРАТА VS РАКЕТА ТА КОРПУС ==================== */
  const redMassMult = config.optRedundancy ? 1.65 : 1.0
  const redCostMult = config.optRedundancy ? 1.5 : 1.0

  const instrMass = validInstruments.reduce((sum, i) => sum + i.massKg, 0)
  const platformMass = platform ? platform.ownMassKg : 0
  const adcsMass = adcs ? adcs.massKg * redMassMult : 0
  const panelsMass = panel ? config.panelAreaM2 * panel.kgPerM2 : 0
  const batteryMass = battery && config.batteryKwh > 0 ? (config.batteryKwh * 1000) / battery.whPerKg : 0
  const radioMass = radio ? radio.massKg * redMassMult : 0
  const memoryMass = memory ? memory.massKg * redMassMult : 0
  const procMass = processor ? processor.massKg : 0
  const engineMass = engine ? engine.massKg : 0
  const optionsMass =
    (config.optEncryption ? 2 : 0) +
    (config.optRadHard ? 4 : 0) +
    (config.optShield ? 5 : 0)

  const spacecraftMassKg =
    platformMass +
    instrMass +
    adcsMass +
    panelsMass +
    batteryMass +
    radioMass +
    memoryMass +
    procMass +
    engineMass +
    optionsMass

  const rocketLimitKg = rocket ? rocket.capKg[config.targetId] : 0
  const dryMassLimitKg = platform ? platform.maxDryMassKg : 0
  const maxInstruments = platform ? platform.maxInstruments : 0
  const busCompatible =
    platform !== null &&
    validInstruments.length <= platform.maxInstruments &&
    spacecraftMassKg <= platform.maxDryMassKg

  /* ==================== 2. ЕНЕРГІЯ ТА БАТАРЕЯ ==================== */
  const powerGenWatts =
    panel && config.panelAreaM2 > 0
      ? config.panelAreaM2 * 1361 * target.solarFlux * panel.efficiency
      : 0

  const instrWatts = validInstruments.reduce((sum, i) => sum + i.powerWatts, 0) * duty
  const powerNeedWatts =
    (platform ? platform.coreWatts : 0) +
    (adcs ? adcs.powerWatts : 0) +
    (radio ? radio.powerWatts : 0) +
    (memory ? memory.powerWatts : 0) +
    (processor ? processor.powerWatts : 0) +
    (engine ? engine.powerWatts : 0) +
    instrWatts +
    (config.optEncryption ? 8 : 0) +
    (config.optRadHard ? 10 : 0) +
    (config.optRedundancy ? 15 : 0)

  const batteryCapacityWh = battery ? config.batteryKwh * 1000 : 0
  const batteryRequiredWh = (powerNeedWatts * target.maxEclipseHours) / 0.85

  /* ==================== 3. ПОГОДИННИЙ ЗАПИС І ПЕРЕДАЧА ДАНИХ ==================== */
  const compression = processor ? processor.compression : 1
  const rawDataHour = validInstruments.reduce((sum, i) => sum + i.dataGbitPerHour, 0) * duty
  const dataRecGbitHour = rawDataHour / compression
  const dataGenGbitDay = dataRecGbitHour * 24

  const requiredPointingDeg = Math.min(
    radio ? radio.pointingDeg : 99,
    ...validInstruments.map((i) => i.pointingDeg)
  )
  const adcsCompatible = adcs !== null && adcs.pointingDeg <= requiredPointingDeg * 3

  const pointingFactor =
    !adcs
      ? 0
      : adcs.pointingDeg <= requiredPointingDeg
        ? 1.0
        : Math.pow(requiredPointingDeg / adcs.pointingDeg, 2)

  const radioBaseRate = radio ? radio.rateGbitPerHour[config.targetId] : 0
  const dataDownlinkGbitHour =
    radioBaseRate * pointingFactor * (config.optEncryption ? 0.90 : 1.0)

  const contactHoursPerDay = target.contactHoursByStations[config.groundStations] ?? 0
  const maxBlackoutHours = target.maxBlackoutHoursByStations[config.groundStations] ?? 24

  const dataDownlinkGbitDay = dataDownlinkGbitHour * contactHoursPerDay
  const memoryRequiredGbit = dataRecGbitHour * maxBlackoutHours
  const memoryCapacityGbit = memory ? memory.capacityGbit : 0

  /* ==================== 4. ТЕРМІН РОБОТИ ТА НАУКА ==================== */
  const lifeMonths = engine ? Math.round(engine.lifeYears * 12) : 12

  const sortedInstr = [...validInstruments].sort((a, b) => b.sciencePoints - a.sciencePoints)
  const scienceRaw = sortedInstr.reduce((sum, inst, idx) => {
    const dimFactor = idx < 4 ? 1.0 : Math.pow(0.85, idx - 3)
    return sum + inst.sciencePoints * dimFactor
  }, 0)

  const activeIds = new Set(validInstruments.map((i) => i.id))
  const synergyBonus = SYNERGIES.reduce(
    (sum, syn) => (activeIds.has(syn.a) && activeIds.has(syn.b) ? sum + syn.bonus : sum),
    0
  )

  const avgInstrSurvival =
    validInstruments.length > 0
      ? validInstruments.reduce((sum, inst) => {
          const pFailYr = annualFailProb(inst.trl)
          return sum + Math.max(0, 1 - pFailYr * (target.tNomMonths / 12))
        }, 0) / validInstruments.length
      : 0

  const scienceInstalled = scienceRaw * (1 + synergyBonus) * avgInstrSurvival

  /* ==================== 5. БЮДЖЕТ ==================== */
  const instrCost = validInstruments.reduce((sum, i) => sum + i.costM, 0)
  const optionsCost =
    (config.optEncryption ? 4 : 0) +
    (config.optRadHard ? 7 : 0) +
    (config.optShield ? 4 : 0)

  const subsystemsCost =
    (panel ? config.panelAreaM2 * panel.costMPerM2 : 0) +
    (battery ? config.batteryKwh * battery.costMPerKwh : 0) +
    ((radio ? radio.costM : 0) +
      (adcs ? adcs.costM : 0) +
      (memory ? memory.costM : 0)) *
      redCostMult +
    (processor ? processor.costM : 0) +
    (engine ? engine.costM : 0) +
    optionsCost

  const groundCost = GROUND_STATION_COSTS_M[config.groundStations] ?? 0
  const budgetUsedM =
    (platform ? platform.costM : 0) +
    instrCost +
    subsystemsCost +
    (rocket ? rocket.costM : 0) +
    groundCost

  const budgetMaxM = target.bClassM
  const budgetReserveFrac =
    budgetMaxM > 0 ? Math.max(0, (budgetMaxM - budgetUsedM) / budgetMaxM) : 0

  /* ==================== 6. НАДІЙНІСТЬ ТА РИЗИКИ ==================== */
  const fBudget = 1 - 0.30 * (1 - Math.exp(-budgetReserveFrac / 0.08))
  const hasMassMargin =
    rocketLimitKg > 0 && (rocketLimitKg - spacecraftMassKg) / rocketLimitKg >= 0.10
  const hasPowerMargin =
    powerGenWatts > 0 && (powerGenWatts - powerNeedWatts) / powerGenWatts >= 0.15
  const fMargin =
    hasMassMargin && hasPowerMargin ? 0.90 : hasMassMargin || hasPowerMargin ? 0.95 : 1.0
  const fRisk = fBudget * fMargin

  const pLaunch = rocket ? 1 - rocket.reliability : 1
  const pTransit = target.bgRiskTransit * fRisk

  const pFlex = panel?.id === 'flex' ? 0.04 * fRisk : 0
  const pIns = 1 - (1 - target.bgRiskIns * fRisk) * (1 - pFlex)

  const yearsNom = target.tNomMonths / 12
  const opsSubsystems = [
    adcs ? { trl: adcs.trl, red: config.optRedundancy } : null,
    radio ? { trl: radio.trl, red: config.optRedundancy } : null,
    memory ? { trl: memory.trl, red: config.optRedundancy } : null,
    panel ? { trl: panel.trl, red: false } : null,
  ].filter((x): x is { trl: number; red: boolean } => x !== null)

  let opsSurvival = 1.0
  for (const sub of opsSubsystems) {
    let pYr = annualFailProb(sub.trl) * fRisk
    if (sub.red) pYr = pYr * pYr
    opsSurvival *= Math.pow(Math.max(0, 1 - pYr), yearsNom)
  }
  const pOps = 1 - opsSurvival

  const failProbTotal = 1 - (1 - pLaunch) * (1 - pTransit) * (1 - pIns) * (1 - pOps)

  /* ==================== 7. ОЦІНКА ЗАГРОЗ ==================== */
  const evaluateThreat = (threatId: (typeof target.threats)[number]['id']): {
    mitigated: boolean
    detail: LocalizedText
  } => {
    if (threatId === 'debris') {
      return config.optShield
        ? {
            mitigated: true,
            detail: {
              en: 'Whipple shield absorbed micrometeorite impacts.',
              uk: 'Екран Віппла витримав удари мікрометеоритів.',
            },
          }
        : {
            mitigated: false,
            detail: {
              en: 'Micrometeorite hit damaged solar array & thermal insulation (-20% science).',
              uk: 'Удар мікрометеорита пошкодив панелі й термоізоляцію (-20% науки).',
            },
          }
    }
    if (threatId === 'cyber_attack') {
      return config.optEncryption
        ? {
            mitigated: true,
            detail: {
              en: 'Encrypted link blocked unauthorized command injection.',
              uk: 'Шифрований канал заблокував спробу підміни команд.',
            },
          }
        : {
            mitigated: false,
            detail: {
              en: 'RF spoofing forced spacecraft into safe mode (-20% science).',
              uk: 'Спуфінг-атака перевела апарат у безпечний режим (-20% науки).',
            },
          }
    }
    if (threatId === 'solar_flare') {
      return config.optRadHard
        ? {
            mitigated: true,
            detail: {
              en: 'Radiation-hardened CPU survived solar proton storm without bit-flips.',
              uk: 'Радіаційно стійкий процесор витримав сонячний спалах без збоїв.',
            },
          }
        : {
            mitigated: false,
            detail: {
              en: 'Solar flare corrupted flight memory and rebooted avionics (-20% science).',
              uk: 'Сонячний спалах пошкодив пам’ять і перезавантажив борт (-20% науки).',
            },
          }
    }
    const requiredBuffer = dataGenGbitDay * 14
    const ok = memoryCapacityGbit >= requiredBuffer && requiredBuffer > 0
    return ok
      ? {
          mitigated: true,
          detail: {
            en: `Onboard storage (${memoryCapacityGbit} Gbit) buffered all 14 days of conjunction data.`,
            uk: `Бортова пам’ять (${memoryCapacityGbit} Гбіт) зберегла всі дані за 14 діб кон’юнкції.`,
          },
        }
      : {
          mitigated: false,
          detail: {
            en: `Buffer overflow during 14-day solar blackout (needed ${Math.ceil(requiredBuffer)} Gbit; -20% science).`,
            uk: `Переповнення пам’яті під час 14-денної кон’юнкції (треба ${Math.ceil(requiredBuffer)} Гбіт; -20% науки).`,
          },
        }
  }

  const threatResults: ThreatResult[] = target.threats.map((threat) => {
    const res = evaluateThreat(threat.id)
    return {
      threat,
      mitigated: res.mitigated,
      detail: res.detail,
    }
  })

  /* ==================== 8. ПЕРЕВІРКА 8 ВЕРХНІХ МЕТРИК ==================== */
  const metricIssues: LocalizedText[] = []

  if (budgetUsedM > budgetMaxM) {
    metricIssues.push({ en: 'Budget', uk: 'Бюджет' })
  }
  if (
    rocketLimitKg <= 0 ||
    spacecraftMassKg <= 0 ||
    spacecraftMassKg > rocketLimitKg ||
    !busCompatible
  ) {
    metricIssues.push({ en: 'Spacecraft Mass', uk: 'Вага апарата' })
  }
  if (dataRecGbitHour <= 0) {
    metricIssues.push({ en: 'Data Recording', uk: 'Запис даних' })
  }
  if (
    contactHoursPerDay <= 0 ||
    dataDownlinkGbitHour <= 0 ||
    dataDownlinkGbitDay < dataGenGbitDay ||
    memoryCapacityGbit <= 0 ||
    memoryCapacityGbit < memoryRequiredGbit ||
    !adcsCompatible
  ) {
    metricIssues.push({ en: 'Earth Downlink', uk: 'Передача на Землю' })
  }
  if (powerGenWatts <= 0 || powerGenWatts < powerNeedWatts) {
    metricIssues.push({ en: 'Power', uk: 'Потужність' })
  }
  if (batteryCapacityWh <= 0 || batteryCapacityWh < batteryRequiredWh) {
    metricIssues.push({ en: 'Battery', uk: 'Батарея' })
  }
  if (scienceInstalled < target.sMin) {
    metricIssues.push({ en: 'Expected Science', uk: 'Очікувана наука' })
  }
  if (failProbTotal > target.rMax && !config.acceptHighRisk) {
    metricIssues.push({ en: 'Failure Risk', uk: 'Ризик провалу' })
  }

  const canLaunch = metricIssues.length === 0

  /* ==================== 9. ОЧІКУВАНА НАУКА ==================== */
  const fDuty = Math.sqrt(duty)
  const fLife = Math.min(1.0, lifeMonths / target.tNomMonths)
  const unmitigatedPreview = threatResults.filter((tr) => !tr.mitigated).length
  const expectedThreatFactor = Math.max(0.5, 1 - 0.14 * unmitigatedPreview)

  const sciencePotential = scienceInstalled * fDuty * fLife * expectedThreatFactor
  const scienceExpected = sciencePotential * (1 - failProbTotal)

  /* ==================== 10. СИМУЛЯЦІЯ ПОЛЬОТУ ==================== */
  const rng = createRng(hashSeed(seed, attempt, 777))
  const telemetryLog: LocalizedText[] = []

  let outcome: MissionOutcome = 'success'
  let failedPhase: MissionPhaseFail | undefined
  let failureReason: LocalizedText | undefined
  let deliveredScience = sciencePotential

  const rocketNameEn = rocket ? rocket.name.en : 'Launch Vehicle'
  const rocketNameUk = rocket ? rocket.name.uk : 'Ракета-носій'

  const phaseList: Array<{
    phase: MissionPhaseFail
    prob: number
    okMsg: LocalizedText
    failMsg: LocalizedText
  }> = [
    {
      phase: 'launch',
      prob: pLaunch,
      okMsg: {
        en: `T+00:12:00 — ${rocketNameEn} nominal insertion into ${target.injectionOrbit.en}.`,
        uk: `T+00:12:00 — ${rocketNameUk} штатно вивела апарат на ${target.injectionOrbit.uk}.`,
      },
      failMsg: {
        en: `T+00:04:18 — ${rocketNameEn} suffered upper-stage anomaly during ascent.`,
        uk: `T+00:04:18 — аварія верхнього ступеня носія «${rocketNameUk}» під час виведення.`,
      },
    },
    {
      phase: 'transit',
      prob: pTransit,
      okMsg: {
        en: `Cruise complete (${target.flightDays} days) — trajectory nominal.`,
        uk: `Переліт завершено (${target.flightDays} діб) — траєкторія в нормі.`,
      },
      failMsg: {
        en: 'Deep-space navigation & attitude loss during interplanetary cruise.',
        uk: 'Втрата орієнтації та зв’язку під час міжпланетного перельоту.',
      },
    },
    {
      phase: 'ins',
      prob: pIns,
      okMsg: {
        en: 'Orbit insertion succeeded; solar arrays deployed.',
        uk: 'Вихід на робочу орбіту успішний; сонячні панелі розгорнуто.',
      },
      failMsg: {
        en: 'Deployment failure during critical orbit insertion.',
        uk: 'Відмова розгортання панелей при виході на робочу орбіту.',
      },
    },
    {
      phase: 'ops',
      prob: pOps,
      okMsg: {
        en: `Orbital science campaign active for ${lifeMonths.toFixed(0)} months.`,
        uk: `Орбітальна наукова програма успішно відпрацювала ${lifeMonths.toFixed(0)} міс.`,
      },
      failMsg: {
        en: 'Critical avionics failure terminated orbital operations early.',
        uk: 'Критична відмова бортової електроніки достроково припинила місію.',
      },
    },
  ]

  if (!canLaunch) {
    outcome = 'blocked'
    deliveredScience = 0
    telemetryLog.push({
      en: 'LAUNCH ABORTED — Resolve red mission metrics before launch.',
      uk: 'ЗАПУСК СКАСОВАНО — виправте червоні метрики місії перед стартом.',
    })
  } else {
    for (const step of phaseList) {
      if (rng() < step.prob) {
        outcome = 'failed'
        failedPhase = step.phase
        failureReason = step.failMsg
        deliveredScience = step.phase === 'ops' ? sciencePotential * 0.25 : 0
        telemetryLog.push(step.failMsg)
        break
      }
      telemetryLog.push(step.okMsg)
    }

    if (outcome === 'success') {
      let threatMultiplier = 1.0
      for (const tr of threatResults) {
        const triggered = rng() < 0.65
        if (triggered) {
          telemetryLog.push(tr.detail)
          if (!tr.mitigated) {
            threatMultiplier *= 0.80
          }
        }
      }
      deliveredScience = sciencePotential * threatMultiplier
      if (deliveredScience < target.sMin) {
        outcome = 'partial'
      }
    }
  }

  /* ==================== 11. ФІНАЛЬНИЙ РЕЙТИНГ (0–1000) ==================== */
  let score = 0
  if (outcome === 'success' || outcome === 'partial') {
    const sciNorm = Math.min(1.0, deliveredScience / target.sRef)
    const relMult = 0.55 + 0.45 * Math.max(0, 1 - failProbTotal)
    const sciScore = 700 * sciNorm * relMult

    const extRatio = Math.max(0, lifeMonths / target.tNomMonths - 1.0) / 1.5
    const lifeScore = 200 * Math.min(1.0, extRatio)

    const massReserveFrac =
      rocketLimitKg > 0 ? Math.max(0, (rocketLimitKg - spacecraftMassKg) / rocketLimitKg) : 0
    const effScore =
      100 * Math.min(1.0, 0.65 * (budgetReserveFrac / 0.25) + 0.35 * (massReserveFrac / 0.25))

    score = Math.round(sciScore + lifeScore + effScore)
  } else if (outcome === 'failed' && failedPhase === 'ops') {
    score = Math.round(140 * Math.min(1, deliveredScience / target.sRef))
  }

  let medal: MedalTier = 'experimental'
  if (outcome === 'success' && score >= 800) {
    medal = 'gold'
  } else if (outcome === 'success' && score >= 600) {
    medal = 'silver'
  } else if (outcome === 'success' || outcome === 'partial') {
    medal = 'bronze'
  }

  return {
    budgetUsedM,
    budgetMaxM,
    budgetReserveFrac,
    spacecraftMassKg,
    dryMassLimitKg,
    rocketLimitKg,
    powerGenWatts,
    powerNeedWatts,
    batteryCapacityWh,
    batteryRequiredWh,
    dataRecGbitHour,
    dataDownlinkGbitHour,
    dataGenGbitDay,
    dataDownlinkGbitDay,
    contactHoursPerDay,
    maxBlackoutHours,
    memoryCapacityGbit,
    memoryRequiredGbit,
    platformName: platform ? platform.name : null,
    instrumentsCount: validInstruments.length,
    maxInstruments,
    busCompatible,
    adcsPointingDeg: adcs ? adcs.pointingDeg : null,
    requiredPointingDeg,
    adcsCompatible,
    engineName: engine ? engine.name : null,
    scienceRaw,
    scienceInstalled,
    sciencePotential,
    scienceExpected,
    scienceMin: target.sMin,
    scienceRef: target.sRef,
    failProbTotal,
    failProbMax: target.rMax,
    phaseProbs: {
      launch: pLaunch,
      transit: pTransit,
      ins: pIns,
      ops: pOps,
    },
    lifeMonths,
    nominalMonths: target.tNomMonths,
    metricIssues,
    canLaunch,
    outcome,
    failedPhase,
    failureReason,
    threatResults,
    telemetryLog,
    score,
    medal,
  }
}