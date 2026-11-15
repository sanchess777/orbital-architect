import type {
  GateStatus,
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

const G0 = 9.81 // м/с²

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

/** Річна ймовірність відмови компонента за рівнем TRL */
function annualFailProb(trl: number): number {
  return 0.004 * Math.pow(1.6, 9 - trl)
}

export function solveMission(
  config: MissionConfig,
  seed: number,
  attempt: number
): MissionReport {
  const target = TARGETS[config.targetId]
  const platform = PLATFORMS.find((p) => p.id === config.platformId) ?? PLATFORMS[0]
  const adcs = ADCS_LIST.find((a) => a.id === config.adcsId) ?? ADCS_LIST[0]
  const panel = SOLAR_PANELS.find((p) => p.id === config.panelId) ?? SOLAR_PANELS[0]
  const battery = BATTERIES.find((b) => b.id === config.batteryId) ?? BATTERIES[0]
  const rocket =
    ROCKETS.find((r) => r.id === config.rocketId && r.targets.includes(config.targetId)) ??
    ROCKETS.find((r) => r.targets.includes(config.targetId)) ??
    ROCKETS[0]
  const engine = ENGINES.find((e) => e.id === config.engineId) ?? ENGINES[0]
  const radio =
    RADIOS.find((r) => r.id === config.radioId && r.targets.includes(config.targetId)) ??
    RADIOS.find((r) => r.targets.includes(config.targetId)) ??
    RADIOS[0]
  const memory = MEMORIES.find((m) => m.id === config.memoryId) ?? MEMORIES[0]
  const processor = PROCESSORS.find((p) => p.id === config.processorId) ?? PROCESSORS[0]

  const validInstruments = INSTRUMENTS.filter(
    (inst) => config.instrumentIds.includes(inst.id) && inst.targets.includes(config.targetId)
  )
  const duty = DUTY_CYCLE_FACTOR[config.dutyCycle] ?? 0.75

  /* ==================== 1. МАСА (ФОРМУЛА ЦІОЛКОВСЬКОГО) ==================== */
  const redMassMult = config.optRedundancy ? 1.65 : 1.0
  const redCostMult = config.optRedundancy ? 1.5 : 1.0

  const instrMass = validInstruments.reduce((sum, i) => sum + i.massKg, 0)
  const adcsMass = adcs.massKg * redMassMult
  const panelsMass = config.panelAreaM2 * panel.kgPerM2
  const batteryMass = (config.batteryKwh * 1000) / battery.whPerKg
  const radioMass = radio.massKg * redMassMult
  const memoryMass = memory.massKg * redMassMult
  const procMass = processor.massKg
  const engineMass = engine.dryMassKg * redMassMult
  const optionsMass =
    (config.optEncryption ? 2 : 0) +
    (config.optRadHard ? 4 : 0) +
    (config.optShield ? 5 : 0)

  const nonPlatformMass =
    instrMass +
    adcsMass +
    panelsMass +
    batteryMass +
    radioMass +
    memoryMass +
    procMass +
    engineMass +
    optionsMass

  const dryMassKg = platform.ownMassKg + 1.18 * nonPlatformMass

  const dvMs = target.dvKmS * 1000
  const skDvMs = target.skDvKmSPerYear * 1000
  const massRatio = Math.exp(dvMs / (engine.ispSec * G0))
  const skPropellant =
    dryMassKg * (Math.exp((skDvMs * config.stationKeepingYears) / (engine.ispSec * G0)) - 1)
  const mainPropellant = (dryMassKg + skPropellant) * (massRatio - 1)
  const propellantMassKg = mainPropellant + skPropellant
  const tanksMassKg = 0.10 * propellantMassKg
  const launchMassKg = 1.03 * (dryMassKg + propellantMassKg + tanksMassKg)

  const rocketCapKg = rocket.capKg[config.targetId]
  const rocketLimitKg = 0.95 * rocketCapKg

  /* ==================== 2. ЕНЕРГІЯ ТА ТЕРМІН СЛУЖБИ ==================== */
  const powerBolWatts = config.panelAreaM2 * 1361 * target.solarFlux * panel.efficiency * 0.85
  const powerGenEolWatts =
    powerBolWatts * Math.pow(1 - target.degradationPerYear, target.tNomMonths / 12)

  const instrWatts = validInstruments.reduce((sum, i) => sum + i.powerWatts, 0)
  const baseAvionicsWatts =
    platform.coreWatts +
    adcs.powerWatts +
    memory.powerWatts +
    processor.powerWatts +
    (config.optEncryption ? 8 : 0) +
    (config.optRadHard ? 10 : 0) +
    (config.optRedundancy ? 15 : 0)

  const powerNeedLightWatts = baseAvionicsWatts + instrWatts * duty + radio.powerWatts
  const powerEclipseWatts = baseAvionicsWatts + 0.5 * instrWatts * duty

  const eclipseWh = powerEclipseWatts * (target.eclipseMin / 60)
  const batteryRequiredWh = eclipseWh / target.maxDoD
  const batteryCapacityWh = config.batteryKwh * 1000

  const sunlitMin = Math.max(1, target.orbitPeriodMin - target.eclipseMin)
  const chargeWatts = eclipseWh / (0.85 * (sunlitMin / 60))
  const totalDayPowerNeed = powerNeedLightWatts + chargeWatts
  const ionCruiseNeedWatts = platform.coreWatts + adcs.powerWatts + engine.powerWatts

  const actualDoD = batteryCapacityWh > 0 ? eclipseWh / batteryCapacityWh : 99
  const dodRatio = target.maxDoD / Math.max(0.05, actualDoD)
  const batteryLifeMonths = target.tNomMonths * Math.min(2.5, Math.pow(dodRatio, 1.1))
  const fuelLifeMonths = 12 * config.stationKeepingYears
  const lifeMonths = Math.min(batteryLifeMonths, fuelLifeMonths)

  /* ==================== 3. ДАНІ ТА ЗВ'ЯЗОК ==================== */
  const rawDataDay = validInstruments.reduce((sum, i) => sum + i.dataGbitPerDay, 0) * duty
  const dataGenGbitDay = rawDataDay / processor.compression

  const stationCov = target.stationCov[config.groundStations - 1]
  const contactSeconds = target.earthVisFrac * stationCov * 86400

  const strictestPointing = Math.min(
    radio.pointingDeg,
    ...validInstruments.map((i) => i.pointingDeg)
  )
  const pointingFactor =
    adcs.pointingDeg <= strictestPointing
      ? 1.0
      : Math.pow(strictestPointing / adcs.pointingDeg, 2)

  const effDataRateMbps =
    radio.rateMbps[config.targetId] * pointingFactor * (config.optEncryption ? 0.90 : 1.0)
  const dataDownlinkGbitDay = (effDataRateMbps * contactSeconds * 0.85) / 1000

  const maxGapHours = target.maxGapHours[config.groundStations - 1]
  const memoryRequiredGbit = 1.2 * dataGenGbitDay * (maxGapHours / 24)
  const memoryCapacityGbit = memory.capacityGbit
  const memoryLossFrac =
    memoryRequiredGbit > 0 ? Math.max(0, 1 - memoryCapacityGbit / memoryRequiredGbit) : 0

  /* ==================== 4. ЧАС ТА ВІКНО ЗАПУСКУ ==================== */
  const allTrls = [
    9,
    rocket.trl,
    engine.trl,
    adcs.trl,
    panel.trl,
    battery.trl,
    radio.trl,
    memory.trl,
    processor.trl,
    ...validInstruments.map((i) => i.trl),
  ]
  const minTrl = Math.min(...allTrls)
  const devMonths =
    target.tBaseMonths +
    platform.devMonths +
    1.5 * (9 - minTrl) +
    0.8 * Math.max(0, validInstruments.length - 1) +
    (config.optRadHard ? 1.5 : 0)

  const readyMonth = devMonths + config.extraTestMonths
  let launchMonth = Math.ceil(readyMonth)

  if (Array.isArray(target.windows)) {
    const found = target.windows.find((w) => w >= readyMonth)
    if (found !== undefined) {
      launchMonth = found
    } else {
      const last = target.windows[target.windows.length - 1]
      launchMonth = last + 26 * Math.ceil((readyMonth - last) / 26)
    }
  }
  const waitMonths = Math.max(0, launchMonth - readyMonth)

  /* ==================== 5. НАУКОВА ЦІННІСТЬ ==================== */
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

  /* ==================== 6. БЮДЖЕТ ==================== */
  const instrCost = validInstruments.reduce((sum, i) => sum + i.costM, 0)
  const optionsCost =
    (config.optEncryption ? 4 : 0) +
    (config.optRadHard ? 7 : 0) +
    (config.optShield ? 4 : 0)

  const subsystemsCost =
    config.panelAreaM2 * panel.costMPerM2 +
    config.batteryKwh * battery.costMPerKwh +
    (radio.costM + adcs.costM + memory.costM + engine.costM) * redCostMult +
    processor.costM +
    optionsCost

  const groundCost = GROUND_STATION_COSTS_M[config.groundStations]
  const opsCost = launchMonth * target.rTeamM + target.tNomMonths * target.rOpsM
  const budgetUsedM =
    platform.costM + instrCost + subsystemsCost + rocket.costM + groundCost + opsCost

  const budgetMaxM = target.bClassM * (1 + 0.20 * Math.min(1, scienceInstalled / target.sRef))
  const budgetReserveFrac =
    budgetMaxM > 0 ? Math.max(0, (budgetMaxM - budgetUsedM) / budgetMaxM) : 0

  /* ==================== 7. НАДІЙНІСТЬ ТА РИЗИКИ ==================== */
  const fTest = 1 - 0.4 * (1 - Math.exp(-(config.extraTestMonths + 0.5 * waitMonths) / 6))
  const fBudget = 1 - 0.35 * (1 - Math.exp(-budgetReserveFrac / 0.08))
  const hasMassMargin = rocketLimitKg > 0 && (rocketLimitKg - launchMassKg) / rocketLimitKg >= 0.10
  const hasPowerMargin =
    powerGenEolWatts > 0 && (powerGenEolWatts - totalDayPowerNeed) / powerGenEolWatts >= 0.15
  const fMargin = hasMassMargin && hasPowerMargin ? 0.90 : hasMassMargin || hasPowerMargin ? 0.95 : 1.0
  const fRisk = fTest * fBudget * fMargin

  const pLaunch = 1 - rocket.reliability
  const pTransit = target.bgRiskTransit * fRisk

  let pEngine = annualFailProb(engine.trl) * fRisk
  if (config.optRedundancy) pEngine = pEngine * pEngine
  const pFlex = panel.id === 'flex' ? 0.04 * fRisk : 0
  const pIns = 1 - (1 - target.bgRiskIns * fRisk) * (1 - 4 * pEngine) * (1 - pFlex)

  const yearsNom = target.tNomMonths / 12
  const opsSubsystems = [
    { trl: adcs.trl, red: config.optRedundancy },
    { trl: radio.trl, red: config.optRedundancy },
    { trl: memory.trl, red: config.optRedundancy },
    { trl: panel.trl, red: false },
  ]
  let opsSurvival = 1.0
  for (const sub of opsSubsystems) {
    let pYr = annualFailProb(sub.trl) * fRisk
    if (sub.red) pYr = pYr * pYr
    opsSurvival *= Math.pow(Math.max(0, 1 - pYr), yearsNom)
  }
  const pOps = 1 - opsSurvival

  const failProbTotal = 1 - (1 - pLaunch) * (1 - pTransit) * (1 - pIns) * (1 - pOps)

  /* ==================== 8. ОЦІНКА ЗАГРОЗ (ПРЕВ'Ю + ПОЛІТ) ==================== */
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
    // conjunction (Mars 14-day blackout)
    const requiredBuffer = dataGenGbitDay * 14
    const ok = memoryCapacityGbit >= requiredBuffer
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

  /* ==================== 9. 11 ВОРІТ GO / NO-GO ==================== */
  const gates: GateStatus[] = [
    {
      id: 'G1',
      owners: ['flight', 'bus'],
      passed: rocketCapKg > 0 && launchMassKg <= rocketLimitKg,
      title: { en: 'G1 · Launch Mass vs Rocket', uk: 'G1 · Стартова маса vs Ракета' },
      summary: {
        en: `${Math.round(launchMassKg)} / ${Math.round(rocketLimitKg)} kg`,
        uk: `${Math.round(launchMassKg)} / ${Math.round(rocketLimitKg)} кг`,
      },
      advice: {
        en: 'Select a heavier rocket, switch to an Ion/Bipropellant engine, or reduce dry mass.',
        uk: 'Оберіть потужнішу ракету, двокомпонентний/іонний двигун або зменште суху масу.',
      },
    },
    {
      id: 'G2',
      owners: ['bus'],
      passed:
        powerGenEolWatts >= totalDayPowerNeed &&
        (engine.id !== 'ion' || powerGenEolWatts >= ionCruiseNeedWatts),
      title: { en: 'G2 · Power Balance (EOL)', uk: 'G2 · Баланс енергії (кінець місії)' },
      summary: {
        en: `${Math.round(powerGenEolWatts)} W gen / ${Math.round(totalDayPowerNeed)} W need`,
        uk: `${Math.round(powerGenEolWatts)} Вт ген. / ${Math.round(totalDayPowerNeed)} Вт потр.`,
      },
      advice: {
        en: 'Increase solar array area, pick GaAs cells, or lower instrument duty cycle.',
        uk: 'Збільште площу панелей, оберіть GaAs або знизьте режим роботи приладів.',
      },
    },
    {
      id: 'G3',
      owners: ['bus'],
      passed: batteryCapacityWh >= batteryRequiredWh,
      title: { en: 'G3 · Eclipse Battery Capacity', uk: 'G3 · Ємність батареї для тіні' },
      summary: {
        en: `${Math.round(batteryCapacityWh)} / ${Math.round(batteryRequiredWh)} Wh`,
        uk: `${Math.round(batteryCapacityWh)} / ${Math.round(batteryRequiredWh)} Вт·год`,
      },
      advice: {
        en: 'Increase battery kWh capacity to survive the planetary shadow.',
        uk: 'Збільште ємність акумулятора (кВт·год) для проходження тіні планети.',
      },
    },
    {
      id: 'G4',
      owners: ['comms'],
      passed: memoryCapacityGbit >= 0.5 * memoryRequiredGbit,
      title: { en: 'G4 · Onboard Data Buffer', uk: 'G4 · Буфер бортової пам’яті' },
      summary: {
        en: `${memoryCapacityGbit} / ${Math.ceil(0.5 * memoryRequiredGbit)} Gbit min`,
        uk: `${memoryCapacityGbit} / ${Math.ceil(0.5 * memoryRequiredGbit)} Гбіт мін.`,
      },
      advice: {
        en: 'Upgrade onboard memory, add data compression, or add ground stations.',
        uk: 'Збільште бортову пам’ять, додайте стиснення даних або наземну станцію.',
      },
    },
    {
      id: 'G5',
      owners: ['comms'],
      passed:
        radio.rateMbps[config.targetId] > 0 && dataDownlinkGbitDay >= 0.25 * dataGenGbitDay,
      title: { en: 'G5 · Earth Downlink Capacity', uk: 'G5 · Пропускна здатність каналу' },
      summary: {
        en: `${dataDownlinkGbitDay.toFixed(1)} / ${(0.25 * dataGenGbitDay).toFixed(1)} Gbit/d min`,
        uk: `${dataDownlinkGbitDay.toFixed(1)} / ${(0.25 * dataGenGbitDay).toFixed(1)} Гбіт/д мін.`,
      },
      advice: {
        en: 'Upgrade radio band (X/Ka/Laser), improve ADCS pointing, or enable compression.',
        uk: 'Потужніший радіодіапазон (X/Ka/Лазер), точніша ADCS або стиснення даних.',
      },
    },
    {
      id: 'G6',
      owners: ['science', 'bus', 'flight', 'comms'],
      passed: budgetUsedM <= budgetMaxM,
      title: { en: 'G6 · Mission Budget Cap', uk: 'G6 · Ліміт бюджету місії' },
      summary: {
        en: `${budgetUsedM.toFixed(1)} / ${budgetMaxM.toFixed(1)} M$`,
        uk: `${budgetUsedM.toFixed(1)} / ${budgetMaxM.toFixed(1)} М$`,
      },
      advice: {
        en: 'Trim expensive subsystems, pick a cheaper rocket, or add high-value science.',
        uk: 'Оптимізуйте дорогі підсистеми, оберіть дешевшу ракету або додайте науку.',
      },
    },
    {
      id: 'G7',
      owners: ['flight'],
      passed:
        launchMonth <= target.tMaxMonths &&
        rocket.availableFromMonth <= launchMonth &&
        config.stationKeepingYears >= 0.5,
      title: { en: 'G7 · Launch Window & Timeline', uk: 'G7 · Графік і вікно запуску' },
      summary: {
        en: `Month ${launchMonth} / max ${target.tMaxMonths}`,
        uk: `Місяць ${launchMonth} / макс. ${target.tMaxMonths}`,
      },
      advice: {
        en: 'Replace low-TRL components or reduce extra test months to catch the launch window.',
        uk: 'Замініть компоненти з низьким TRL або зменште додаткові тести, щоб встигнути у вікно.',
      },
    },
    {
      id: 'G8',
      owners: ['bus', 'science', 'flight'],
      passed:
        validInstruments.length <= platform.maxInstruments &&
        dryMassKg <= platform.maxDryMassKg &&
        adcs.pointingDeg <= strictestPointing * 3 &&
        rocketCapKg > 0,
      title: { en: 'G8 · Physical & Pointing Compatibility', uk: 'G8 · Сумісність платформи й ADCS' },
      summary: {
        en: `${validInstruments.length}/${platform.maxInstruments} inst · ${Math.round(dryMassKg)}/${platform.maxDryMassKg} kg`,
        uk: `${validInstruments.length}/${platform.maxInstruments} прил. · ${Math.round(dryMassKg)}/${platform.maxDryMassKg} кг`,
      },
      advice: {
        en: 'Choose a larger bus, remove excess instruments, or upgrade ADCS pointing precision.',
        uk: 'Оберіть більшу платформу, приберіть зайві прилади або покращте точність ADCS.',
      },
    },
    {
      id: 'G9',
      owners: ['science'],
      passed: scienceInstalled >= target.sMin,
      title: { en: 'G9 · Minimum Science Threshold', uk: 'G9 · Мінімальна наукова цінність' },
      summary: {
        en: `${scienceInstalled.toFixed(1)} / ${target.sMin} pts min`,
        uk: `${scienceInstalled.toFixed(1)} / ${target.sMin} балів мін.`,
      },
      advice: {
        en: 'Add scientific instruments or combine synergistic pairs.',
        uk: 'Додайте наукові прилади або скомбінуйте синергічні пари.',
      },
    },
    {
      id: 'G10',
      owners: ['flight'],
      passed: failProbTotal <= target.rMax || config.acceptHighRisk,
      title: { en: 'G10 · Mission Reliability Gate', uk: 'G10 · Допустимий ризик провалу' },
      summary: {
        en: `${(failProbTotal * 100).toFixed(1)}% / max ${(target.rMax * 100).toFixed(0)}%`,
        uk: `${(failProbTotal * 100).toFixed(1)}% / макс. ${(target.rMax * 100).toFixed(0)}%`,
      },
      advice: {
        en: 'Pick a proven TRL-9 rocket, enable redundancy, add test months, or check Risk Override.',
        uk: 'Оберіть надійнішу ракету (TRL 9), резервування, тести або дозвольте підвищений ризик.',
      },
    },
    {
      id: 'G11',
      owners: ['science', 'bus', 'flight', 'comms'],
      passed:
        validInstruments.length >= 1 &&
        config.panelAreaM2 > 0 &&
        config.batteryKwh > 0 &&
        config.orbitConfirmed,
      title: { en: 'G11 · Complete Spacecraft Configuration', uk: 'G11 · Повнота конфігурації апарата' },
      summary: {
        en: `${validInstruments.length} inst · ${config.panelAreaM2} m² · ${config.batteryKwh} kWh`,
        uk: `${validInstruments.length} прил. · ${config.panelAreaM2} м² · ${config.batteryKwh} кВт·год`,
      },
      advice: {
        en: 'Ensure at least 1 instrument, solar arrays, battery, and orbit confirmation are set.',
        uk: 'Перевірте наявність мінімум 1 приладу, панелей, батареї та підтвердженої орбіти.',
      },
    },
  ]

  const allGatesPassed = gates.every((g) => g.passed)

  /* ==================== 10. ОЧІКУВАНА НАУКА (ДЛЯ HUD) ==================== */
  const fDuty = Math.sqrt(duty)
  const fData =
    dataGenGbitDay > 0
      ? Math.min(1.0, dataDownlinkGbitDay / dataGenGbitDay) * (1 - memoryLossFrac)
      : 1.0
  const fLife = Math.min(1.0, lifeMonths / target.tNomMonths)
  const fFresh = Math.max(0.65, 1 - 0.012 * Math.max(0, launchMonth - target.tBaseMonths))

  const unmitigatedPreview = threatResults.filter((tr) => !tr.mitigated).length
  const expectedThreatFactor = Math.max(0.5, 1 - 0.14 * unmitigatedPreview)

  const sciencePotential = scienceInstalled * fDuty * fData * fLife * fFresh * expectedThreatFactor
  const scienceExpected = sciencePotential * (1 - failProbTotal)

  /* ==================== 11. ДЕТЕРМІНОВАНА СИМУЛЯЦІЯ ПОЛЬОТУ ==================== */
  const rng = createRng(hashSeed(seed, attempt, 777))
  const telemetryLog: LocalizedText[] = []

  let outcome: MissionOutcome = 'success'
  let failedPhase: MissionPhaseFail | undefined
  let failureReason: LocalizedText | undefined
  let deliveredScience = sciencePotential

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
        en: `T+00:12:00 — ${rocket.name.en} nominal insertion into ${target.injectionOrbit.en}.`,
        uk: `T+00:12:00 — ${rocket.name.uk} штатно вивела апарат на ${target.injectionOrbit.uk}.`,
      },
      failMsg: {
        en: `T+00:04:18 — ${rocket.name.en} suffered upper-stage anomaly during ascent.`,
        uk: `T+00:04:18 — аварія верхнього ступеня носія «${rocket.name.uk}» під час виведення.`,
      },
    },
    {
      phase: 'transit',
      prob: pTransit,
      okMsg: {
        en: `Cruise complete (${target.flightDays + engine.extraFlightDays[config.targetId]} days) — trajectory nominal.`,
        uk: `Переліт завершено (${target.flightDays + engine.extraFlightDays[config.targetId]} діб) — траєкторія в нормі.`,
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
        en: `Orbit insertion burn (${target.dvKmS} km/s) succeeded; solar arrays deployed.`,
        uk: `Гальмівний імпульс (${target.dvKmS} км/с) успішний; сонячні панелі розгорнуто.`,
      },
      failMsg: {
        en: 'Propulsion / deployment failure during critical orbit insertion maneuver.',
        uk: 'Відмова рушійної установки або розгортання панелей при виході на орбіту.',
      },
    },
    {
      phase: 'ops',
      prob: pOps,
      okMsg: {
        en: `Orbital science campaign active for ${lifeMonths.toFixed(1)} months.`,
        uk: `Орбітальна наукова програма успішно відпрацювала ${lifeMonths.toFixed(1)} міс.`,
      },
      failMsg: {
        en: 'Critical avionics failure terminated orbital operations early.',
        uk: 'Критична відмова бортової електроніки достроково припинила місію.',
      },
    },
  ]

  if (!allGatesPassed) {
    outcome = 'blocked'
    deliveredScience = 0
    telemetryLog.push({
      en: 'LAUNCH ABORTED — One or more Go/No-Go engineering gates failed.',
      uk: 'ЗАПУСК СКАСОВАНО — не пройдено обов’язкові інженерні ворота Go/No-Go.',
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

  /* ==================== 12. ФІНАЛЬНИЙ РЕЙТИНГ (0–1000) ТА МЕДАЛЬ ==================== */
  let score = 0
  if (outcome === 'success' || outcome === 'partial') {
    const sciNorm = Math.min(1.0, deliveredScience / target.sRef)
    const relMult = 0.55 + 0.45 * Math.max(0, 1 - failProbTotal)
    const sciScore = 700 * sciNorm * relMult

    const extRatio = Math.max(0, lifeMonths / target.tNomMonths - 1.0) / 1.2
    const lifeScore = 200 * Math.min(1.0, extRatio)

    const massReserveFrac =
      rocketLimitKg > 0 ? Math.max(0, (rocketLimitKg - launchMassKg) / rocketLimitKg) : 0
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
    dryMassKg,
    dryMassLimitKg: platform.maxDryMassKg,
    propellantMassKg,
    launchMassKg,
    rocketLimitKg,
    powerGenEolWatts,
    powerNeedLightWatts: totalDayPowerNeed,
    powerEclipseWatts,
    batteryCapacityWh,
    batteryRequiredWh,
    actualDoD,
    dataGenGbitDay,
    dataDownlinkGbitDay,
    memoryCapacityGbit,
    memoryRequiredGbit,
    devMonths,
    launchMonth,
    maxLaunchMonth: target.tMaxMonths,
    waitMonths,
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
    gates,
    allGatesPassed,
    outcome,
    failedPhase,
    failureReason,
    threatResults,
    telemetryLog,
    score,
    medal,
  }
}