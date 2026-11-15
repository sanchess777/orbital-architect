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

const G0 = 9.81

/** Детермінований PRNG mulberry32 (однаковий результат на всіх клієнтах) */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function annualFailProb(trl: number): number {
  return 0.004 * Math.pow(1.6, 9 - trl)
}

function findOrFirst<T extends { id: string }>(list: T[], id: string): T {
  return list.find((item) => item.id === id) ?? list[0]
}

export function solveMission(config: MissionConfig, seed = 42, attempt = 1): MissionReport {
  const target = TARGETS[config.targetId] ?? TARGETS.leo
  const platform = findOrFirst(PLATFORMS, config.platformId)
  const rocket = findOrFirst(ROCKETS, config.rocketId)
  const engine = findOrFirst(ENGINES, config.engineId)
  const adcs = findOrFirst(ADCS_LIST, config.adcsId)
  const panel = findOrFirst(SOLAR_PANELS, config.panelId)
  const battery = findOrFirst(BATTERIES, config.batteryId)
  const radio = findOrFirst(RADIOS, config.radioId)
  const memory = findOrFirst(MEMORIES, config.memoryId)
  const proc = findOrFirst(PROCESSORS, config.processorId)

  const selectedInstruments = config.instrumentIds
    .map((id) => INSTRUMENTS.find((inst) => inst.id === id))
    .filter((inst): inst is NonNullable<typeof inst> => Boolean(inst))

  const duty = DUTY_CYCLE_FACTOR[config.dutyCycle] ?? 0.7
  const redMassMult = config.optRedundancy ? 1.8 : 1.0
  const redCostMult = config.optRedundancy ? 1.6 : 1.0

  /* ==================== 1. МАСА Й ПАЛИВО ==================== */
  const instrMass = selectedInstruments.reduce((acc, i) => acc + i.massKg, 0)
  const adcsMass = adcs.massKg * redMassMult
  const panelsMass = config.panelAreaM2 * panel.kgPerM2
  const batteryMass = (config.batteryKwh * 1000) / battery.whPerKg
  const radioMass = radio.massKg * redMassMult
  const memMass = memory.massKg * redMassMult
  const procMass = proc.massKg
  const engineMass = engine.dryMassKg * redMassMult
  const optsMass =
    (config.optEncryption ? 1 : 0) + (config.optRadHard ? 2 : 0) + (config.optShield ? 4 : 0)

  const nonPlatformMass =
    instrMass + adcsMass + panelsMass + batteryMass + radioMass + memMass + procMass + engineMass + optsMass
  const structMass = 0.18 * nonPlatformMass
  const dryMassKg = platform.ownMassKg + nonPlatformMass + structMass

  const deltaV = target.dvKmS * 1000
  const skDeltaVYear = target.skDvKmSPerYear * 1000
  const massRatio = Math.exp(deltaV / (engine.ispSec * G0))
  const skPropMass = dryMassKg * (Math.exp((skDeltaVYear * config.stationKeepingYears) / (engine.ispSec * G0)) - 1)
  const mainPropMass = (dryMassKg + skPropMass) * (massRatio - 1)
  const propellantMassKg = mainPropMass + skPropMass
  const tankMassKg = 0.10 * propellantMassKg
  const launchMassKg = 1.03 * (dryMassKg + propellantMassKg + tankMassKg)
  const rocketCapKg = rocket.capKg[target.id]
  const rocketLimitKg = 0.95 * rocketCapKg

  /* ==================== 2. ЕНЕРГІЯ Й ТЕРМІН СЛУЖБИ ==================== */
  const pBol = config.panelAreaM2 * 1361 * target.solarFlux * panel.efficiency * 0.85
  const pEol = pBol * Math.pow(1 - target.degradationPerYear, target.tNomMonths / 12)

  const instrWattsTotal = selectedInstruments.reduce((acc, i) => acc + i.powerWatts, 0)
  const baseWatts =
    platform.coreWatts + adcs.powerWatts + memory.powerWatts + proc.powerWatts + (config.optEncryption ? 5 : 0)

  const powerNeedLightWatts = baseWatts + instrWattsTotal * duty + radio.powerWatts
  const powerEclipseWatts = baseWatts + 0.5 * instrWattsTotal * duty

  const eclipseEnergyWh = powerEclipseWatts * (target.eclipseMin / 60)
  const batteryRequiredWh = eclipseEnergyWh / target.maxDoD
  const batteryCapacityWh = config.batteryKwh * 1000
  const sunlitMin = Math.max(1, target.orbitPeriodMin - target.eclipseMin)
  const chargeWatts = eclipseEnergyWh / (0.85 * (sunlitMin / 60))
  const totalDayPowerReq = powerNeedLightWatts + chargeWatts
  const ionCruisePowerReq = platform.coreWatts + adcs.powerWatts + engine.powerWatts

  const actualDoD = batteryCapacityWh > 0 ? eclipseEnergyWh / batteryCapacityWh : 99
  const batteryLifeMonths =
    actualDoD > target.maxDoD
      ? target.tNomMonths * Math.pow(target.maxDoD / actualDoD, 3)
      : target.tNomMonths
  const fuelLifeMonths = 12 * config.stationKeepingYears
  const lifeMonths = Math.min(batteryLifeMonths, fuelLifeMonths)

  /* ==================== 3. ДАНІ Й ЗВ'ЯЗОК ==================== */
  const rawDataGbitDay = selectedInstruments.reduce((acc, i) => acc + i.dataGbitPerDay, 0) * duty
  const dataGenGbitDay = rawDataGbitDay / proc.compression

  const stationCov = target.stationCov[config.groundStations - 1]
  const contactSecPerDay = target.earthVisFrac * stationCov * 86400
  const strictestPointingDeg = Math.min(
    radio.pointingDeg,
    ...selectedInstruments.map((i) => i.pointingDeg),
  )
  const pointingFactor =
    adcs.pointingDeg <= strictestPointingDeg
      ? 1
      : Math.pow(strictestPointingDeg / adcs.pointingDeg, 2)

  const effectiveRateMbps = radio.rateMbps[target.id] * pointingFactor
  const dataDownlinkGbitDay = (effectiveRateMbps * contactSecPerDay * 0.85) / 1000

  const maxGapHours = target.maxGapHours[config.groundStations - 1]
  const memoryRequiredGbit = 1.2 * dataGenGbitDay * (maxGapHours / 24)
  const memoryLossFrac =
    memoryRequiredGbit > 0 ? Math.max(0, 1 - memory.capacityGbit / memoryRequiredGbit) : 0

  /* ==================== 4. ЧАС І ВІКНО ЗАПУСКУ ==================== */
  const trls = [
    9,
    rocket.trl,
    engine.trl,
    adcs.trl,
    panel.trl,
    battery.trl,
    radio.trl,
    memory.trl,
    proc.trl,
    ...selectedInstruments.map((i) => i.trl),
  ]
  const minTrl = Math.min(...trls)
  const devMonths =
    target.tBaseMonths +
    platform.devMonths +
    1.5 * (9 - minTrl) +
    0.8 * Math.max(0, selectedInstruments.length - 1)

  const readyMonths = devMonths + config.extraTestMonths
  let launchMonth = Math.ceil(readyMonths)
  if (Array.isArray(target.windows)) {
    const found = target.windows.find((w) => w >= readyMonths)
    if (found !== undefined) {
      launchMonth = found
    } else {
      const last = target.windows[target.windows.length - 1]
      launchMonth = last + 26 * Math.ceil((readyMonths - last) / 26)
    }
  }
  const waitMonths = Math.max(0, launchMonth - readyMonths)

  /* ==================== 5. НАУКА (ПОПЕРЕДНЯ ДЛЯ БЮДЖЕТУ) ==================== */
  const sortedBySci = [...selectedInstruments].sort((a, b) => b.sciencePoints - a.sciencePoints)
  const scienceRaw = sortedBySci.reduce((sum, inst, idx) => {
    const weight = idx < 4 ? 1 : Math.pow(0.85, idx - 3)
    return sum + inst.sciencePoints * weight
  }, 0)

  const idSet = new Set(config.instrumentIds)
  const synergyBonus = SYNERGIES.reduce(
    (sum, syn) => (idSet.has(syn.a) && idSet.has(syn.b) ? sum + syn.bonus : sum),
    0,
  )

  const avgInstSurvival =
    selectedInstruments.length > 0
      ? selectedInstruments.reduce(
          (sum, inst) => sum + Math.max(0, 1 - (annualFailProb(inst.trl) * target.tNomMonths) / 12),
          0,
        ) / selectedInstruments.length
      : 0

  const scienceInstalled = scienceRaw * (1 + synergyBonus) * avgInstSurvival

  /* ==================== 6. БЮДЖЕТ ==================== */
  const instrCost = selectedInstruments.reduce((acc, i) => acc + i.costM, 0)
  const optsCost =
    (config.optEncryption ? 3 : 0) + (config.optRadHard ? 5 : 0) + (config.optShield ? 2 : 0)

  const sysCost =
    config.panelAreaM2 * panel.costMPerM2 +
    config.batteryKwh * battery.costMPerKwh +
    (radio.costM + adcs.costM + memory.costM + engine.costM) * redCostMult +
    proc.costM +
    optsCost

  const gndCost = GROUND_STATION_COSTS_M[config.groundStations]
  const opsCost = launchMonth * target.rTeamM + target.tNomMonths * target.rOpsM
  const budgetUsedM = platform.costM + instrCost + sysCost + rocket.costM + gndCost + opsCost
  const budgetMaxM = target.bClassM * (1 + 0.25 * Math.min(1, scienceInstalled / target.sRef))
  const budgetReserveFrac = budgetMaxM > 0 ? Math.max(0, (budgetMaxM - budgetUsedM) / budgetMaxM) : 0

  /* ==================== 7. НАДІЙНІСТЬ ==================== */
  const fTest = 1 - 0.4 * (1 - Math.exp(-(config.extraTestMonths + 0.5 * waitMonths) / 6))
  const fBud = 1 - 0.35 * (1 - Math.exp(-budgetReserveFrac / 0.08))

  const hasMassMargin = rocketLimitKg > 0 && (rocketLimitKg - launchMassKg) / rocketLimitKg >= 0.10
  const hasPowerMargin = pEol > 0 && (pEol - totalDayPowerReq) / pEol >= 0.15
  const fMar = hasMassMargin && hasPowerMargin ? 0.90 : hasMassMargin || hasPowerMargin ? 0.95 : 1.0
  const fRisk = fTest * fBud * fMar

  const pLaunch = 1 - rocket.reliability
  const pTransit = target.bgRiskTransit * fRisk

  let pEngineYear = annualFailProb(engine.trl) * fRisk
  if (config.optRedundancy) pEngineYear = pEngineYear * pEngineYear
  const pFlexDeploy = panel.id === 'flex' ? 0.04 * fRisk : 0
  const pIns = 1 - (1 - target.bgRiskIns * fRisk) * (1 - 4 * pEngineYear) * (1 - pFlexDeploy)

  const yearsNom = target.tNomMonths / 12
  const critList: Array<{ trl: number; redundant: boolean }> = [
    { trl: adcs.trl, redundant: config.optRedundancy },
    { trl: radio.trl, redundant: config.optRedundancy },
    { trl: memory.trl, redundant: config.optRedundancy },
    { trl: panel.trl, redundant: false },
  ]
  const opsSurvival = critList.reduce((prod, item) => {
    let pYr = annualFailProb(item.trl) * fRisk
    if (item.redundant) pYr = pYr * pYr
    return prod * Math.pow(Math.max(0, 1 - pYr), yearsNom)
  }, 1)
  const pOps = 1 - opsSurvival

  const failProbTotal = 1 - (1 - pLaunch) * (1 - pTransit) * (1 - pIns) * (1 - pOps)

  /* ==================== 8. ДЕТЕРМІНОВАНІ ЗАГРОЗИ ЦІЛІ ==================== */
  const threatResults: ThreatResult[] = target.threats.map((threat) => {
    if (threat.id === 'debris') {
      const ok = config.optShield
      return {
        threat,
        mitigated: ok,
        detail: ok
          ? {
              en: 'Micrometeorite shield absorbed orbital debris impacts with zero damage.',
              uk: 'Екран від мікрометеоритів поглинув удари уламків без пошкоджень.',
            }
          : {
              en: 'Debris impact damaged secondary radiators (-20% science output).',
              uk: 'Удар уламків пошкодив радіатори охолодження (-20% наукової віддачі).',
            },
      }
    }
    if (threat.id === 'cyber_attack') {
      const ok = config.optEncryption
      return {
        threat,
        mitigated: ok,
        detail: ok
          ? {
              en: 'Encrypted RF link blocked unauthorized ground-station command spoofing.',
              uk: 'Шифрований канал заблокував спробу підміни телекоманд із землі.',
            }
          : {
              en: 'Spoofed ground command triggered Safe Mode (-20% science output).',
              uk: 'Підміна команд перевела апарат у безпечний режим (-20% наукової віддачі).',
            },
      }
    }
    if (threat.id === 'solar_flare') {
      const ok = config.optRadHard
      return {
        threat,
        mitigated: ok,
        detail: ok
          ? {
              en: 'Radiation-hardened computer weathered solar particle storm cleanly.',
              uk: 'Радіаційно стійкий комп’ютер витримав сонячний спалах без збоїв.',
            }
          : {
              en: 'Memory bit-flips during solar storm forced reboots (-20% science output).',
              uk: 'Збої пам’яті під час сонячного спалаху викликали перезавантаження (-20% науки).',
            },
      }
    }
    // conjunction (Mars 14-day blackout)
    const neededBuffer = dataGenGbitDay * 14
    const ok = memory.capacityGbit >= neededBuffer
    return {
      threat,
      mitigated: ok,
      detail: ok
        ? {
            en: `Onboard memory (${memory.capacityGbit} Gbit) buffered all 14 days of solar conjunction (${neededBuffer.toFixed(0)} Gbit needed).`,
            uk: `Бортова пам’ять (${memory.capacityGbit} Гбіт) зберегла всі дані за 14 діб кон’юнкції (потрібно ${neededBuffer.toFixed(0)} Гбіт).`,
          }
        : {
            en: `Memory overflowed during 14-day solar conjunction (${memory.capacityGbit} / ${neededBuffer.toFixed(0)} Gbit, -20% science).`,
            uk: `Переповнення пам’яті за 14 діб сонячної кон’юнкції (${memory.capacityGbit} / ${neededBuffer.toFixed(0)} Гбіт, -20% науки).`,
          },
    }
  })

  const unmitigatedThreats = threatResults.filter((t) => !t.mitigated).length
  const threatFactor = Math.max(0.4, 1 - 0.2 * unmitigatedThreats)

  /* ==================== 9. ОЧІКУВАНА НАУКА ==================== */
  const fDuty = Math.sqrt(duty)
  const fData =
    dataGenGbitDay > 0
      ? Math.min(1, dataDownlinkGbitDay / dataGenGbitDay) * (1 - memoryLossFrac)
      : 1
  const fLife = Math.min(1, lifeMonths / target.tNomMonths)
  const fFresh = Math.max(0.6, 1 - 0.015 * Math.max(0, launchMonth - target.tBaseMonths))

  const sciencePotential = scienceInstalled * fDuty * fData * fLife * fFresh * threatFactor
  const scienceExpected = sciencePotential * (1 - failProbTotal)

  /* ==================== 10. ОДИНАДЦЯТЬ ВОРІТ GO / NO-GO ==================== */
  const compatibleInstruments = selectedInstruments.every((i) => i.targets.includes(target.id))
  const pointingOk = adcs.pointingDeg <= strictestPointingDeg * 3
  const fuelYearsOk = config.stationKeepingYears >= 0.5
  const ionPowerOk = engine.id !== 'ion' || pEol >= ionCruisePowerReq

  const gates: GateStatus[] = [
    {
      id: 'G1',
      owners: ['flight'],
      passed: rocketCapKg > 0 && launchMassKg <= rocketLimitKg,
      title: { en: 'G1 · Launch Mass', uk: 'G1 · Стартова маса' },
      summary: {
        en: `${launchMassKg.toFixed(0)} / ${rocketLimitKg.toFixed(0)} kg`,
        uk: `${launchMassKg.toFixed(0)} / ${rocketLimitKg.toFixed(0)} кг`,
      },
      advice: {
        en: 'Reduce payload/fuel mass or select a heavier launch vehicle.',
        uk: 'Зменште масу приладів/палива або оберіть потужнішу ракету-носій.',
      },
    },
    {
      id: 'G2',
      owners: ['bus'],
      passed: pEol >= totalDayPowerReq && ionPowerOk,
      title: { en: 'G2 · Daylight Power', uk: 'G2 · Енергія на світлі' },
      summary: {
        en: !ionPowerOk
          ? `Ion thruster needs ${ionCruisePowerReq} W (EOL: ${pEol.toFixed(0)} W)`
          : `${pEol.toFixed(0)} / ${totalDayPowerReq.toFixed(0)} W`,
        uk: !ionPowerOk
          ? `Іонний двигун потребує ${ionCruisePowerReq} Вт (EOL: ${pEol.toFixed(0)} Вт)`
          : `${pEol.toFixed(0)} / ${totalDayPowerReq.toFixed(0)} Вт`,
      },
      advice: {
        en: 'Increase solar array area, switch to GaAs panels, or lower instrument duty cycle.',
        uk: 'Збільште площу панелей, перейдіть на GaAs або знизьте режим роботи приладів.',
      },
    },
    {
      id: 'G3',
      owners: ['bus'],
      passed: batteryCapacityWh >= batteryRequiredWh,
      title: { en: 'G3 · Eclipse Battery', uk: 'G3 · Енергія в тіні' },
      summary: {
        en: `${batteryCapacityWh.toFixed(0)} / ${batteryRequiredWh.toFixed(0)} Wh`,
        uk: `${batteryCapacityWh.toFixed(0)} / ${batteryRequiredWh.toFixed(0)} Вт·год`,
      },
      advice: {
        en: 'Increase battery capacity to survive orbital eclipse within DoD limits.',
        uk: 'Збільште ємність батарей, щоб пережити тінь без глибокого розряду.',
      },
    },
    {
      id: 'G4',
      owners: ['comms'],
      passed: memory.capacityGbit >= 0.5 * memoryRequiredGbit,
      title: { en: 'G4 · Onboard Buffer', uk: 'G4 · Бортова пам’ять' },
      summary: {
        en: `${memory.capacityGbit} / ${(0.5 * memoryRequiredGbit).toFixed(0)} Gbit min`,
        uk: `${memory.capacityGbit} / ${(0.5 * memoryRequiredGbit).toFixed(0)} Гбіт мін.`,
      },
      advice: {
        en: 'Upgrade onboard storage or add ground stations to shorten downlink gaps.',
        uk: 'Збільште обсяг пам’яті або додайте наземні станції для частіших сеансів.',
      },
    },
    {
      id: 'G5',
      owners: ['comms'],
      passed: radio.rateMbps[target.id] > 0 && dataDownlinkGbitDay >= 0.25 * dataGenGbitDay,
      title: { en: 'G5 · Downlink Channel', uk: 'G5 · Канал зв’язку' },
      summary: {
        en:
          radio.rateMbps[target.id] <= 0
            ? 'Radio out of range for target'
            : `${dataDownlinkGbitDay.toFixed(1)} / ${(0.25 * dataGenGbitDay).toFixed(1)} Gbit/d min`,
        uk:
          radio.rateMbps[target.id] <= 0
            ? 'Радіо не добиває до цієї цілі'
            : `${dataDownlinkGbitDay.toFixed(1)} / ${(0.25 * dataGenGbitDay).toFixed(1)} Гбіт/д мін.`,
      },
      advice: {
        en: 'Use X/Ka-band dish, enable onboard compression, or add ground stations.',
        uk: 'Оберіть антену X/Ka-діапазону, увімкніть стиснення даних або додайте станції.',
      },
    },
    {
      id: 'G6',
      owners: ['science', 'bus', 'flight', 'comms'],
      passed: budgetUsedM <= budgetMaxM,
      title: { en: 'G6 · Mission Budget', uk: 'G6 · Бюджет місії' },
      summary: {
        en: `$${budgetUsedM.toFixed(1)}M / $${budgetMaxM.toFixed(1)}M`,
        uk: `${budgetUsedM.toFixed(1)} / ${budgetMaxM.toFixed(1)} М$`,
      },
      advice: {
        en: 'Cut hardware/rocket cost, shorten prep time, or add high-value science.',
        uk: 'Здешевте ракету/обладнання, скоротіть підготовку або додайте цінні прилади.',
      },
    },
    {
      id: 'G7',
      owners: ['flight'],
      passed:
        launchMonth <= target.tMaxMonths &&
        rocket.availableFromMonth <= launchMonth &&
        fuelYearsOk,
      title: { en: 'G7 · Schedule & Fuel', uk: 'G7 · Терміни та паливо' },
      summary: {
        en: !fuelYearsOk
          ? 'Station-keeping fuel < 0.5 yr'
          : rocket.availableFromMonth > launchMonth
            ? `Rocket ready at mo. ${rocket.availableFromMonth}`
            : `Launch mo. ${launchMonth} / max ${target.tMaxMonths}`,
        uk: !fuelYearsOk
          ? 'Запас палива < 0,5 року'
          : rocket.availableFromMonth > launchMonth
            ? `Ракета доступна з ${rocket.availableFromMonth} міс.`
            : `Старт ${launchMonth} міс. / макс. ${target.tMaxMonths}`,
      },
      advice: {
        en: 'Replace low-TRL components to hit an earlier launch window and keep >= 0.5 yr fuel.',
        uk: 'Замініть сирі (низький TRL) модулі, щоб встигнути у вікно, і задайте >= 0,5 року палива.',
      },
    },
    {
      id: 'G8',
      owners: ['science', 'bus', 'flight'],
      passed:
        compatibleInstruments &&
        selectedInstruments.length <= platform.maxInstruments &&
        dryMassKg <= platform.maxDryMassKg &&
        pointingOk &&
        rocketCapKg > 0,
      title: { en: 'G8 · Compatibility', uk: 'G8 · Сумісність систем' },
      summary: {
        en: !rocketCapKg
          ? 'Rocket cannot reach target'
          : !compatibleInstruments
            ? 'Instrument invalid for target'
            : selectedInstruments.length > platform.maxInstruments
              ? `Too many instruments (${selectedInstruments.length}/${platform.maxInstruments})`
              : dryMassKg > platform.maxDryMassKg
                ? `Dry mass ${dryMassKg.toFixed(0)} > bus ${platform.maxDryMassKg} kg`
                : !pointingOk
                  ? `ADCS ${adcs.pointingDeg}° too coarse for ${strictestPointingDeg}°`
                  : 'All interfaces nominal',
        uk: !rocketCapKg
          ? 'Ракета не долітає до цілі'
          : !compatibleInstruments
            ? 'Прилад не підходить для цієї цілі'
            : selectedInstruments.length > platform.maxInstruments
              ? `Забагато приладів (${selectedInstruments.length}/${platform.maxInstruments})`
              : dryMassKg > platform.maxDryMassKg
                ? `Суха маса ${dryMassKg.toFixed(0)} > ліміту корпусу ${platform.maxDryMassKg} кг`
                : !pointingOk
                  ? `Точність ADCS ${adcs.pointingDeg}° заслабка для ${strictestPointingDeg}°`
                  : 'Усі інтерфейси узгоджено',
      },
      advice: {
        en: 'Match bus size, ADCS precision, rocket capability, and target-valid instruments.',
        uk: 'Узгодьте розмір платформи, точність ADCS, траєкторію ракети та прилади цілі.',
      },
    },
    {
      id: 'G9',
      owners: ['science'],
      passed: scienceInstalled >= target.sMin,
      title: { en: 'G9 · Minimum Science', uk: 'G9 · Мінімум науки' },
      summary: {
        en: `${scienceInstalled.toFixed(1)} / ${target.sMin} pts`,
        uk: `${scienceInstalled.toFixed(1)} / ${target.sMin} балів`,
      },
      advice: {
        en: 'Add scientific instruments or combine synergistic sensors.',
        uk: 'Додайте наукові прилади або скомбінуйте синергічні сенсори.',
      },
    },
    {
      id: 'G10',
      owners: ['flight'],
      passed: failProbTotal <= target.rMax || config.acceptHighRisk,
      title: { en: 'G10 · Risk Threshold', uk: 'G10 · Допустимий ризик' },
      summary: {
        en: `${(failProbTotal * 100).toFixed(1)}% / max ${(target.rMax * 100).toFixed(0)}%`,
        uk: `${(failProbTotal * 100).toFixed(1)}% / макс. ${(target.rMax * 100).toFixed(0)}%`,
      },
      advice: {
        en: 'Add testing months, keep budget reserve, enable redundancy, or accept high risk.',
        uk: 'Додайте місяці тестів, залиште резерв бюджету, увімкніть резервування або прийміть ризик.',
      },
    },
    {
      id: 'G11',
      owners: ['science', 'bus', 'flight', 'comms'],
      passed: selectedInstruments.length >= 1 && config.panelAreaM2 > 0 && config.batteryKwh > 0,
      title: { en: 'G11 · Completeness', uk: 'G11 · Комплектність' },
      summary: {
        en: `${selectedInstruments.length} inst · ${config.panelAreaM2} m² · ${config.batteryKwh} kWh`,
        uk: `${selectedInstruments.length} прил. · ${config.panelAreaM2} м² · ${config.batteryKwh} кВт·год`,
      },
      advice: {
        en: 'Ensure at least 1 instrument, solar arrays > 0 m², and battery > 0 kWh.',
        uk: 'Оберіть хоча б 1 прилад, сонячні панелі > 0 м² та батареї > 0 кВт·год.',
      },
    },
  ]

  const allGatesPassed = gates.every((g) => g.passed)

  /* ==================== 11. СИМУЛЯЦІЯ ПОЛЬОТУ Й ЛОГ ТЕЛЕМЕТРІЇ ==================== */
  const totalFlightDays = target.flightDays + engine.extraFlightDays[target.id]
  const telemetryLog: LocalizedText[] = [
    {
      en: `[T-00m] Spacecraft integration complete. Dry mass ${dryMassKg.toFixed(0)} kg, wet mass ${launchMassKg.toFixed(0)} kg.`,
      uk: `[T-00м] Збірку завершено. Суха маса ${dryMassKg.toFixed(0)} кг, стартова маса ${launchMassKg.toFixed(0)} кг.`,
    },
    {
      en: `[T+${launchMonth}m] Launch window open. Liftoff aboard ${rocket.name.en} toward ${target.injectionOrbit.en}.`,
      uk: `[T+${launchMonth}м] Вікно запуску відкрито. Старт на носії «${rocket.name.uk}» до ${target.injectionOrbit.uk}.`,
    },
  ]

  let outcome: MissionOutcome = 'blocked'
  let failedPhase: MissionPhaseFail | undefined
  let failureReason: LocalizedText | undefined

  if (allGatesPassed) {
    const rng = mulberry32((seed ^ Math.imul(attempt, 0x9e3779b9)) >>> 0)
    const uLaunch = rng()
    const uTransit = rng()
    const uIns = rng()
    const uOps = rng()

    if (uLaunch < pLaunch) {
      outcome = 'failed'
      failedPhase = 'launch'
      failureReason = {
        en: `Launch vehicle anomaly during ascent (${rocket.name.en}, failure prob ${(pLaunch * 100).toFixed(1)}%).`,
        uk: `Аварія ракети-носія на ділянці виведення (${rocket.name.uk}, ризик ${(pLaunch * 100).toFixed(1)}%).`,
      }
      telemetryLog.push({
        en: `[LAUNCH] CRITICAL: Trajectory deviation during main stage burn. Mission lost.`,
        uk: `[СТАРТ] КРИТИЧНО: Відхилення траєкторії на активній ділянці. Місію втрачено.`,
      })
    } else if (uTransit < pTransit) {
      outcome = 'failed'
      failedPhase = 'transit'
      failureReason = {
        en: `Deep-space cruise anomaly during ${totalFlightDays}-day transit (risk ${(pTransit * 100).toFixed(1)}%).`,
        uk: `Відмова систем під час ${totalFlightDays}-добового перельоту (ризик ${(pTransit * 100).toFixed(1)}%).`,
      }
      telemetryLog.push({
        en: `[TRANSIT] CRITICAL: Loss of attitude lock during interplanetary cruise. Mission lost.`,
        uk: `[ПЕРЕЛІТ] КРИТИЧНО: Втрата орієнтації на трасі перельоту. Місію втрачено.`,
      })
    } else if (uIns < pIns) {
      outcome = 'failed'
      failedPhase = 'ins'
      failureReason = {
        en: `Orbit insertion / array deployment failure (${engine.name.en}, risk ${(pIns * 100).toFixed(1)}%).`,
        uk: `Збій під час виходу на орбіту або розгортання панелей (${engine.name.uk}, ризик ${(pIns * 100).toFixed(1)}%).`,
      }
      telemetryLog.push({
        en: `[INSERTION] CRITICAL: Propulsion burn / solar deployment anomaly at target arrival. Mission lost.`,
        uk: `[ОРБІТА] КРИТИЧНО: Аномалія гальмівного імпульсу або розгортання панелей. Місію втрачено.`,
      })
    } else {
      telemetryLog.push({
        en: `[D+${totalFlightDays}] Nominal orbit insertion achieved. Power EOL ${pEol.toFixed(0)} W, downlink ${dataDownlinkGbitDay.toFixed(1)} Gbit/day.`,
        uk: `[Д+${totalFlightDays}] Штатний вихід на робочу орбіту. Потужність ${pEol.toFixed(0)} Вт, канал ${dataDownlinkGbitDay.toFixed(1)} Гбіт/добу.`,
      })

      for (const tr of threatResults) {
        telemetryLog.push({
          en: `[EVENT] ${tr.threat.name.en}: ${tr.detail.en}`,
          uk: `[ПОДІЯ] ${tr.threat.name.uk}: ${tr.detail.uk}`,
        })
      }

      if (uOps < pOps) {
        outcome = 'failed'
        failedPhase = 'ops'
        failureReason = {
          en: `Critical subsystem failure during orbital operations (risk ${(pOps * 100).toFixed(1)}%).`,
          uk: `Відмова критичної підсистеми під час роботи на орбіті (ризик ${(pOps * 100).toFixed(1)}%).`,
        }
        telemetryLog.push({
          en: `[OPS] CRITICAL: Bus avionics/ADCS failure ended nominal operations early.`,
          uk: `[РОБОТА] КРИТИЧНО: Відмова бортової авіоніки/орієнтації достроково завершила місію.`,
        })
      } else {
        const isPartial = fData < 0.7 || unmitigatedThreats > 0
        outcome = isPartial ? 'partial' : 'success'
        telemetryLog.push({
          en: `[END] Mission completed after ${lifeMonths.toFixed(1)} months. Net science delivered: ${sciencePotential.toFixed(1)} pts.`,
          uk: `[ФІНІШ] Місію завершено через ${lifeMonths.toFixed(1)} міс. Зібрано науки: ${sciencePotential.toFixed(1)} балів.`,
        })
      }
    }
  }

  /* ==================== 12. ПІДСУМКОВИЙ БАЛ (0–1000) ==================== */
  const sciNorm = Math.min(1, scienceExpected / target.sRef)
  const relNorm = Math.max(0, 1 - failProbTotal)
  const lifeNorm = Math.min(1, lifeMonths / target.tNomMonths)
  const rawScore = 1000 * (0.50 * sciNorm + 0.30 * relNorm + 0.20 * lifeNorm)

  const score =
    outcome === 'blocked'
      ? 0
      : outcome === 'failed'
        ? Math.round(rawScore * 0.3)
        : Math.round(rawScore)

  const medal: MedalTier =
    score >= 800
      ? 'gold'
      : score >= 600
        ? 'silver'
        : score >= 400
          ? 'bronze'
          : 'experimental'

  return {
    budgetUsedM,
    budgetMaxM,
    budgetReserveFrac,
    dryMassKg,
    dryMassLimitKg: platform.maxDryMassKg,
    propellantMassKg,
    launchMassKg,
    rocketLimitKg,
    powerGenEolWatts: pEol,
    powerNeedLightWatts,
    powerEclipseWatts,
    batteryCapacityWh,
    batteryRequiredWh,
    actualDoD,
    dataGenGbitDay,
    dataDownlinkGbitDay,
    memoryCapacityGbit: memory.capacityGbit,
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