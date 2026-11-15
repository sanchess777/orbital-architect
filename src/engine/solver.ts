import type {
  LocalizedText,
  MedalTier,
  MissionConfig,
  MissionOutcome,
  MissionPhaseFail,
  MissionReport,
} from '../types/game'
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

  /* ==================== 1. ВАГА АПАРАТА VS РАКЕТА ТА СЛОТИ КОРПУСУ ==================== */
  const redMassMult = config.optRedundancy ? 1.5 : 1.0
  const redCostMult = config.optRedundancy ? 1.4 : 1.0

  const instrMass = validInstruments.reduce((sum, i) => sum + i.massKg, 0)
  const platformMass = platform ? platform.ownMassKg : 0
  const adcsMass = adcs ? adcs.massKg * redMassMult : 0
  const panelsMass = panel ? config.panelAreaM2 * panel.kgPerM2 : 0
  const batteryMass = battery && config.batteryKwh > 0 ? config.batteryKwh * battery.kgPerKwh : 0
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
  const maxInstruments = platform ? platform.maxInstruments : 0
  const busCompatible =
    platform !== null && validInstruments.length <= platform.maxInstruments

  /* ==================== 2. ЕНЕРГІЯ ТА БАТАРЕЯ ==================== */
  const powerGenWatts =
    panel && config.panelAreaM2 > 0
      ? config.panelAreaM2 * 1361 * target.solarFlux * panel.efficiency
      : 0

  const instrWatts = validInstruments.reduce((sum, i) => sum + i.powerWatts, 0)
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
    (config.optRedundancy ? 12 : 0)

  const batteryCapacityWh = battery ? config.batteryKwh * 1000 : 0
  const batteryRequiredWh = (powerNeedWatts * target.maxEclipseHours) / 0.85

  /* ==================== 3. ПОГОДИННИЙ ЗАПИС І ПЕРЕДАЧА ДАНИХ ==================== */
  const compression = processor ? processor.compression : 1
  const rawDataHour = validInstruments.reduce((sum, i) => sum + i.dataGbitPerHour, 0)
  const dataRecGbitHour = rawDataHour / compression
  const dataGenGbitDay = dataRecGbitHour * 24

  const dataDownlinkGbitHour = radio ? radio.rateGbitPerHour[config.targetId] : 0
  const contactHoursPerDay = target.contactHoursByStations[config.groundStations] ?? 0
  const maxBlackoutHours = target.maxBlackoutHoursByStations[config.groundStations] ?? 24

  const dataDownlinkGbitDay = dataDownlinkGbitHour * contactHoursPerDay
  const memoryRequiredGbit = dataRecGbitHour * maxBlackoutHours
  const memoryCapacityGbit = memory ? memory.capacityGbit : 0

  /* ==================== 4. ТЕРМІН РОБОТИ ТА НАУКА ==================== */
  const addYears = engine ? engine.lifeAddYears : 0
  const lifeMonths = target.tNomMonths + addYears * 12
  const lifeMult = engine ? engine.scienceBonusMult : 1.0
  const lifeBonusPct = Math.round((lifeMult - 1.0) * 100)

  const scienceRaw = validInstruments.reduce((sum, inst) => sum + inst.sciencePoints, 0)
  const activeIds = new Set(validInstruments.map((i) => i.id))
  const synergyBonus = SYNERGIES.reduce(
    (sum, syn) => (activeIds.has(syn.a) && activeIds.has(syn.b) ? sum + syn.bonus : sum),
    0
  )

  const adcsScienceBonus = adcs ? adcs.scienceBonus : 0
  const adcsSelected = adcs !== null

  const scienceInstalled = (scienceRaw * (1 + synergyBonus) + adcsScienceBonus) * lifeMult
  const sciencePotential = scienceInstalled

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

  /* ==================== 6. РИЗИК ПРОВАЛУ ТА ЗАХИСНІ ОПЦІЇ ==================== */
  const pLaunch = rocket ? 1 - rocket.reliability : 1

  const shieldTransitFactor = config.optShield ? 0.72 : 1.0
  const radHardTransitFactor = config.optRadHard ? 0.75 : 1.0
  const pTransit = target.bgRiskTransit * shieldTransitFactor * radHardTransitFactor

  const radHardInsFactor = config.optRadHard ? 0.78 : 1.0
  const reserveFactor = 1 - 0.12 * Math.min(1, budgetReserveFrac / 0.15)
  const pIns = target.bgRiskIns * radHardInsFactor * reserveFactor

  let pOps = target.bgRiskOps
  if (config.optRedundancy) pOps *= 0.55
  if (config.optRadHard) pOps *= 0.80
  if (config.optShield) pOps *= 0.82
  if (config.optEncryption) pOps *= 0.80
  pOps *= reserveFactor

  const failProbTotal = 1 - (1 - pLaunch) * (1 - pTransit) * (1 - pIns) * (1 - pOps)
  const scienceExpected = sciencePotential * (1 - failProbTotal)

  /* ==================== 7. ПЕРЕВІРКА 8 ВЕРХНІХ МЕТРИК ==================== */
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
    memoryCapacityGbit < memoryRequiredGbit
  ) {
    metricIssues.push({ en: 'Earth Downlink', uk: 'Передача на Землю' })
  }
  if (powerGenWatts <= 0 || powerGenWatts < powerNeedWatts) {
    metricIssues.push({ en: 'Power', uk: 'Потужність' })
  }
  if (batteryCapacityWh <= 0 || batteryCapacityWh < batteryRequiredWh) {
    metricIssues.push({ en: 'Battery', uk: 'Батарея' })
  }
  if (scienceInstalled < target.sMin || !adcsSelected) {
    metricIssues.push({ en: 'Expected Science', uk: 'Очікувана наука' })
  }
  if (failProbTotal > target.rMax) {
    metricIssues.push({ en: 'Failure Risk', uk: 'Ризик провалу' })
  }

  const canLaunch = metricIssues.length === 0

  /* ==================== 8. СИМУЛЯЦІЯ ПОЛЬОТУ ТА ЧАСТКОВИХ ЗБОЇВ ==================== */
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
        en: 'Deep-space navigation & radiation fault during transit.',
        uk: 'Критичний збій навігації та електроніки під час перельоту.',
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
      prob: pOps * 0.35,
      okMsg: {
        en: `Orbital science campaign active for ${lifeMonths.toFixed(0)} months.`,
        uk: `Орбітальна наукова програма відпрацювала ${lifeMonths.toFixed(0)} міс.`,
      },
      failMsg: {
        en: 'Critical subsystem failure terminated orbital operations early.',
        uk: 'Критична відмова бортових систем достроково припинила місію.',
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
        deliveredScience = step.phase === 'ops' ? sciencePotential * 0.2 : 0
        telemetryLog.push(step.failMsg)
        break
      }
      telemetryLog.push(step.okMsg)
    }

    if (outcome === 'success') {
      // Симуляція нефатальних збоїв на орбіті (мінус очки науки при поломці)
      const minorEvents: Array<{
        chance: number
        lossFrac: number
        msg: LocalizedText
      }> = [
        {
          chance: config.optShield ? 0.04 : 0.22,
          lossFrac: 0.25,
          msg: {
            en: 'Micrometeorite impact degraded thermal & optical sensor (-25% science).',
            uk: 'Удар мікрометеорита пошкодив сенсорний блок (-25% очок науки).',
          },
        },
        {
          chance: config.optRadHard ? 0.04 : 0.22,
          lossFrac: 0.25,
          msg: {
            en: 'Solar particle event caused memory bit-flips and data loss (-25% science).',
            uk: 'Сонячний спалах спричинив збій електроніки та втрату даних (-25% очок науки).',
          },
        },
        {
          chance: config.optEncryption ? 0.03 : 0.18,
          lossFrac: 0.20,
          msg: {
            en: 'Command-link interference forced unscheduled safe-mode reboot (-20% science).',
            uk: 'Перешкоди в каналі управління перевели апарат у безпечний режим (-20% очок науки).',
          },
        },
        {
          chance: config.optRedundancy ? 0.04 : 0.24,
          lossFrac: 0.25,
          msg: {
            en: 'Secondary power bus degradation reduced instrument uptime (-25% science).',
            uk: 'Деградація вторинної шини живлення скоротила час зйомки (-25% очок науки).',
          },
        },
      ]

      let sciMultiplier = 1.0
      for (const ev of minorEvents) {
        if (rng() < ev.chance) {
          sciMultiplier *= 1 - ev.lossFrac
          telemetryLog.push(ev.msg)
        }
      }

      deliveredScience = sciencePotential * sciMultiplier
      if (deliveredScience < target.sMin) {
        outcome = 'partial'
      }
    }
  }

  /* ==================== 9. ФІНАЛЬНИЙ РЕЙТИНГ (0–100 ВИКЛЮЧНО ЗА НАУКУ) ==================== */
  let score = 0
  if (outcome === 'success' || outcome === 'partial') {
    score = Math.min(100, Math.round((deliveredScience / target.sRef) * 100))
  } else if (outcome === 'failed' && failedPhase === 'ops') {
    score = Math.min(100, Math.round((deliveredScience / target.sRef) * 100))
  }

  let medal: MedalTier = 'experimental'
  if (outcome === 'success' && score >= 80) {
    medal = 'gold'
  } else if (outcome === 'success' && score >= 60) {
    medal = 'silver'
  } else if ((outcome === 'success' || outcome === 'partial') && score >= 35) {
    medal = 'bronze'
  }

  return {
    budgetUsedM,
    budgetMaxM,
    budgetReserveFrac,
    spacecraftMassKg,
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
    adcsName: adcs ? adcs.name : null,
    adcsScienceBonus,
    adcsSelected,
    engineName: engine ? engine.name : null,
    lifeBonusPct,
    scienceRaw,
    scienceInstalled,
    sciencePotential,
    scienceExpected,
    deliveredScience,
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
    threatResults: [],
    telemetryLog,
    score,
    medal,
  }
}