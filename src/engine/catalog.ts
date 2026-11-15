import type {
  AdcsSpec,
  BatterySpec,
  DutyCycleId,
  EngineSpec,
  GroundStationCount,
  InstrumentSpec,
  LocalizedText,
  MemorySpec,
  MissionConfig,
  MissionTarget,
  PlatformSpec,
  ProcessorSpec,
  RadioSpec,
  RocketSpec,
  SolarPanelSpec,
  TargetId,
} from '../types/game'

export const TARGET_ORDER: TargetId[] = ['leo', 'moon', 'mars']

export const TARGETS: Record<TargetId, MissionTarget> = {
  leo: {
    id: 'leo',
    name: { en: 'Low Earth Orbit (LEO)', uk: 'Низька навколоземна орбіта (LEO)' },
    goal: {
      en: 'High-resolution Earth remote sensing, oceanography & atmospheric monitoring.',
      uk: 'Дистанційне зондування Землі високої роздільності, океанографія та моніторинг атмосфери.',
    },
    injectionOrbit: { en: 'LEO 500 km (SSO)', uk: 'LEO 500 км (ССО)' },
    flightDays: 1,
    signalDelay: { en: '4 ms', uk: '4 мс' },
    solarFlux: 1.0,
    maxEclipseHours: 0.6,
    contactHoursByStations: [0, 3.5, 6.5, 10.0],
    maxBlackoutHoursByStations: [24, 8, 4, 2],
    tNomMonths: 12,
    bClassM: 200,
    bgRiskTransit: 0.04,
    bgRiskIns: 0.05,
    bgRiskOps: 0.14,
    sMin: 40,
    sRef: 135,
    rMax: 0.20,
    analog: { en: 'Sentinel-2 / Landsat-9', uk: 'Sentinel-2 / Landsat-9' },
  },
  moon: {
    id: 'moon',
    name: { en: 'Lunar Polar Orbit', uk: 'Полярна орбіта Місяця' },
    goal: {
      en: 'Prospecting water-ice deposits in permanently shadowed craters & crustal mapping.',
      uk: 'Пошук покладів водяного льоду в затінених кратерах та картографування кори.',
    },
    injectionOrbit: { en: 'Lunar Polar 100 km', uk: 'Полярна орбіта 100 км' },
    flightDays: 5,
    signalDelay: { en: '1.3 s', uk: '1,3 с' },
    solarFlux: 1.0,
    maxEclipseHours: 2.2,
    contactHoursByStations: [0, 5.0, 9.0, 14.0],
    maxBlackoutHoursByStations: [24, 6, 3, 1.5],
    tNomMonths: 12,
    bClassM: 320,
    bgRiskTransit: 0.06,
    bgRiskIns: 0.07,
    bgRiskOps: 0.16,
    sMin: 55,
    sRef: 165,
    rMax: 0.25,
    analog: { en: 'Lunar Reconnaissance Orbiter (LRO)', uk: 'Lunar Reconnaissance Orbiter (LRO)' },
  },
  mars: {
    id: 'mars',
    name: { en: 'Mars Reconnaissance Orbit', uk: 'Орбіта розвідки Марса' },
    goal: {
      en: 'Subsurface ice sounding, mineralogical spectroscopy & trace-gas mapping.',
      uk: 'Зондування підповерхневого льоду, спектроскопія мінералів та пошук малих газів.',
    },
    injectionOrbit: { en: 'Mars 250 × 320 km', uk: 'Марс 250 × 320 км' },
    flightDays: 210,
    signalDelay: { en: '4 – 22 min', uk: '4 – 22 хв' },
    solarFlux: 0.43,
    maxEclipseHours: 1.4,
    contactHoursByStations: [0, 3.0, 5.5, 8.5],
    maxBlackoutHoursByStations: [24, 10, 6, 3.5],
    tNomMonths: 12,
    bClassM: 520,
    bgRiskTransit: 0.08,
    bgRiskIns: 0.09,
    bgRiskOps: 0.18,
    sMin: 70,
    sRef: 205,
    rMax: 0.30,
    analog: { en: 'Mars Reconnaissance Orbiter (MRO)', uk: 'Mars Reconnaissance Orbiter (MRO)' },
  },
}

/* ==================== ПЛАТФОРМИ (КОРПУСИ) ==================== */
export const PLATFORMS: PlatformSpec[] = [
  {
    id: 'bus_small',
    name: { en: 'Compact Bus (2 slots)', uk: 'Мала платформа (2 прилади)' },
    maxInstruments: 2,
    ownMassKg: 30,
    coreWatts: 20,
    costM: 12,
    targets: ['leo', 'moon', 'mars'],
  },
  {
    id: 'bus_medium',
    name: { en: 'Standard Bus (3 slots)', uk: 'Середня платформа (3 прилади)' },
    maxInstruments: 3,
    ownMassKg: 60,
    coreWatts: 35,
    costM: 22,
    targets: ['leo', 'moon', 'mars'],
  },
  {
    id: 'bus_large',
    name: { en: 'Heavy Bus (4 slots)', uk: 'Велика платформа (4 прилади)' },
    maxInstruments: 4,
    ownMassKg: 95,
    coreWatts: 50,
    costM: 34,
    targets: ['leo', 'moon', 'mars'],
  },
]

/* ==================== НАУКОВІ ПРИЛАДИ ==================== */
export const INSTRUMENTS: InstrumentSpec[] = [
  // LEO
  {
    id: 'leo_msi',
    name: { en: 'Multispectral Earth Imager', uk: 'Мультиспектральна камера Землі' },
    targets: ['leo'],
    massKg: 24,
    powerWatts: 38,
    dataGbitPerHour: 0.8,
    sciencePoints: 14,
    costM: 16,
  },
  {
    id: 'leo_limb',
    name: { en: 'Atmospheric Limb Sounder (CO₂/CH₄)', uk: 'Атмосферний лімб-зондувальник (CO₂/CH₄)' },
    targets: ['leo'],
    massKg: 22,
    powerWatts: 32,
    dataGbitPerHour: 0.4,
    sciencePoints: 16,
    costM: 18,
  },
  {
    id: 'leo_sar',
    name: { en: 'Synthetic Aperture Radar (SAR)', uk: 'Радар із синтезованою апертурою (SAR)' },
    targets: ['leo'],
    massKg: 52,
    powerWatts: 95,
    dataGbitPerHour: 2.4,
    sciencePoints: 24,
    costM: 30,
  },
  {
    id: 'leo_tir',
    name: { en: 'Ocean Thermal Infrared Radiometer', uk: 'Інфрачервоний тепловізор океану' },
    targets: ['leo'],
    massKg: 20,
    powerWatts: 42,
    dataGbitPerHour: 0.6,
    sciencePoints: 13,
    costM: 15,
  },
  {
    id: 'leo_mag',
    name: { en: 'Ionospheric Vector Magnetometer', uk: 'Іоносферний векторний магнітометр' },
    targets: ['leo'],
    massKg: 12,
    powerWatts: 14,
    dataGbitPerHour: 0.2,
    sciencePoints: 10,
    costM: 10,
  },
  {
    id: 'leo_grav',
    name: { en: 'Quantum Gravity Gradiometer', uk: 'Квантовий гравіметр' },
    targets: ['leo'],
    massKg: 36,
    powerWatts: 55,
    dataGbitPerHour: 0.5,
    sciencePoints: 21,
    costM: 26,
  },

  // MOON
  {
    id: 'moon_lroc',
    name: { en: 'High-Res Stereo Terrain Camera', uk: 'Стереокамера рельєфу високої роздільності' },
    targets: ['moon'],
    massKg: 28,
    powerWatts: 45,
    dataGbitPerHour: 0.9,
    sciencePoints: 18,
    costM: 22,
  },
  {
    id: 'moon_lend',
    name: { en: 'Epithermal Neutron Ice Detector', uk: 'Нейтронний детектор полярного льоду' },
    targets: ['moon'],
    massKg: 26,
    powerWatts: 36,
    dataGbitPerHour: 0.3,
    sciencePoints: 20,
    costM: 25,
  },
  {
    id: 'moon_mini_rf',
    name: { en: 'Dual-Frequency Polarimetric Radar', uk: 'Двочастотний поляриметричний радар' },
    targets: ['moon'],
    massKg: 58,
    powerWatts: 105,
    dataGbitPerHour: 2.2,
    sciencePoints: 28,
    costM: 38,
  },
  {
    id: 'moon_diviner',
    name: { en: 'Lunar Thermal & Mineral Mapper', uk: 'Інфрачервоний картограф мінералів' },
    targets: ['moon'],
    massKg: 24,
    powerWatts: 40,
    dataGbitPerHour: 0.6,
    sciencePoints: 17,
    costM: 21,
  },
  {
    id: 'moon_grail',
    name: { en: 'Ka-Band Gravity Field Ranging', uk: 'Гравітаційний інтерферометр кори' },
    targets: ['moon'],
    massKg: 38,
    powerWatts: 52,
    dataGbitPerHour: 0.4,
    sciencePoints: 24,
    costM: 30,
  },
  {
    id: 'moon_ldex',
    name: { en: 'Exospheric Dust & Plasma Analyzer', uk: 'Аналізатор пилу та екзосфери' },
    targets: ['moon'],
    massKg: 16,
    powerWatts: 18,
    dataGbitPerHour: 0.2,
    sciencePoints: 14,
    costM: 15,
  },

  // MARS
  {
    id: 'mars_hirise',
    name: { en: 'Sub-Meter Telescopic Imager', uk: 'Телескопічна камера субметрової роздільності' },
    targets: ['mars'],
    massKg: 36,
    powerWatts: 55,
    dataGbitPerHour: 0.9,
    sciencePoints: 24,
    costM: 34,
  },
  {
    id: 'mars_sharad',
    name: { en: 'Subsurface Ice Sounding Radar', uk: 'Підповерхневий радар пошуку льоду' },
    targets: ['mars'],
    massKg: 65,
    powerWatts: 115,
    dataGbitPerHour: 1.8,
    sciencePoints: 34,
    costM: 52,
  },
  {
    id: 'mars_crism',
    name: { en: 'Hyperspectral Mineral Spectrometer', uk: 'Гіперспектральний спектрометр мінералів' },
    targets: ['mars'],
    massKg: 32,
    powerWatts: 48,
    dataGbitPerHour: 0.7,
    sciencePoints: 26,
    costM: 38,
  },
  {
    id: 'mars_nomad',
    name: { en: 'Atmospheric Methane & Isotope Suite', uk: 'Спектрометр метану та ізотопів атмосфери' },
    targets: ['mars'],
    massKg: 28,
    powerWatts: 38,
    dataGbitPerHour: 0.4,
    sciencePoints: 22,
    costM: 30,
  },
  {
    id: 'mars_maven',
    name: { en: 'Solar Wind & Magnetosphere Sensor', uk: 'Аналізатор сонячного вітру та магнітосфери' },
    targets: ['mars'],
    massKg: 18,
    powerWatts: 20,
    dataGbitPerHour: 0.2,
    sciencePoints: 16,
    costM: 20,
  },
  {
    id: 'mars_mola',
    name: { en: 'Orbital Laser Altimeter (LIDAR)', uk: 'Орбітальний лазерний висотомір (LIDAR)' },
    targets: ['mars'],
    massKg: 46,
    powerWatts: 75,
    dataGbitPerHour: 0.8,
    sciencePoints: 30,
    costM: 44,
  },
]

export const SYNERGIES: Array<{
  a: string
  b: string
  bonus: number
  label: LocalizedText
}> = [
  {
    a: 'leo_msi',
    b: 'leo_tir',
    bonus: 0.12,
    label: { en: 'Optical + Thermal Fusion (+12%)', uk: 'Оптика + Тепловізор (+12%)' },
  },
  {
    a: 'leo_sar',
    b: 'leo_grav',
    bonus: 0.12,
    label: { en: 'Geodesy + SAR Interferometry (+12%)', uk: 'Геодезія + SAR (+12%)' },
  },
  {
    a: 'moon_lend',
    b: 'moon_mini_rf',
    bonus: 0.14,
    label: { en: 'Polar Ice Confirmation (+14%)', uk: 'Підтвердження льоду (+14%)' },
  },
  {
    a: 'mars_hirise',
    b: 'mars_crism',
    bonus: 0.14,
    label: { en: 'Landing Site Characterization (+14%)', uk: 'Картографія місць посадки (+14%)' },
  },
  {
    a: 'mars_sharad',
    b: 'mars_mola',
    bonus: 0.14,
    label: { en: '3D Cryosphere Tomography (+14%)', uk: '3D-томографія кріосфери (+14%)' },
  },
]

/* ==================== РАКЕТИ-НОСІЇ ==================== */
export const ROCKETS: RocketSpec[] = [
  {
    id: 'rk_light',
    name: { en: 'Small Commercial Launcher', uk: 'Малий комерційний носій' },
    targets: ['leo', 'moon', 'mars'],
    capKg: { leo: 180, moon: 160, mars: 140 },
    costM: 14,
    reliability: 0.96,
  },
  {
    id: 'rk_medium',
    name: { en: 'Medium Orbital Launcher', uk: 'Легкий орбітальний носій' },
    targets: ['leo', 'moon', 'mars'],
    capKg: { leo: 320, moon: 300, mars: 270 },
    costM: 26,
    reliability: 0.97,
  },
  {
    id: 'rk_heavy',
    name: { en: 'Heavy-Lift Launch Vehicle', uk: 'Середній носій високої вантажності' },
    targets: ['leo', 'moon', 'mars'],
    capKg: { leo: 520, moon: 490, mars: 460 },
    costM: 42,
    reliability: 0.985,
  },
]

/* ==================== СИСТЕМА СТАБІЛІЗАЦІЇ (ADCS) ==================== */
export const ADCS_LIST: AdcsSpec[] = [
  {
    id: 'adcs_basic',
    name: { en: 'Basic (Magnetorquers + Wheels)', uk: 'Базова (магнітна + маховики)' },
    scienceBonus: 5,
    massKg: 8,
    powerWatts: 10,
    costM: 6,
  },
  {
    id: 'adcs_precise',
    name: { en: 'Precise (Star Trackers)', uk: 'Точна (зоряні датчики)' },
    scienceBonus: 10,
    massKg: 14,
    powerWatts: 18,
    costM: 11,
  },
  {
    id: 'adcs_ultra',
    name: { en: 'Ultra-Precise (CMG + Star Trackers)', uk: 'Ультраточна (гіродини + зоряні датчики)' },
    scienceBonus: 15,
    massKg: 22,
    powerWatts: 28,
    costM: 17,
  },
]

/* ==================== РУШІЇ КЕРУВАННЯ ==================== */
export const ENGINES: EngineSpec[] = [
  {
    id: 'eng_coldgas',
    name: { en: 'Cold-Gas Microthrusters', uk: 'Мікродвигуни на стисненому газі' },
    massKg: 10,
    powerWatts: 6,
    costM: 6,
    lifeAddYears: 1,
    scienceBonusMult: 1.15,
  },
  {
    id: 'eng_hydrazine',
    name: { en: 'Hydrazine Monopropellant', uk: 'Гідразинові рушії орієнтації' },
    massKg: 20,
    powerWatts: 14,
    costM: 13,
    lifeAddYears: 2,
    scienceBonusMult: 1.30,
  },
  {
    id: 'eng_ion',
    name: { en: 'Xenon Ion Station-Keeping', uk: 'Іонні рушії корекції (ксенон)' },
    massKg: 32,
    powerWatts: 34,
    costM: 22,
    lifeAddYears: 4,
    scienceBonusMult: 1.50,
  },
]

/* ==================== СОНЯЧНІ ПАНЕЛІ ==================== */
export const SOLAR_PANELS: SolarPanelSpec[] = [
  {
    id: 'sp_silicon',
    name: { en: 'Silicon Arrays (18%)', uk: 'Кремнієві панелі (18%)' },
    efficiency: 0.18,
    kgPerM2: 3.2,
    costMPerM2: 0.5,
  },
  {
    id: 'sp_gaas',
    name: { en: 'Triple-Junction GaAs (28%)', uk: 'Арсенід галію, 3 переходи (28%)' },
    efficiency: 0.28,
    kgPerM2: 2.0,
    costMPerM2: 1.5,
  },
  {
    id: 'sp_flex',
    name: { en: 'Flexible Roll-Out Arrays (24%)', uk: 'Гнучкі розгортні панелі (24%)' },
    efficiency: 0.24,
    kgPerM2: 1.3,
    costMPerM2: 1.1,
  },
]

/* ==================== АКУМУЛЯТОРНІ БАТАРЕЇ ==================== */
export const BATTERIES: BatterySpec[] = [
  {
    id: 'bat_nih2',
    name: { en: 'Nickel-Hydrogen', uk: 'Нікель-водневі' },
    kgPerKwh: 20.0,
    costMPerKwh: 1.0,
  },
  {
    id: 'bat_liion',
    name: { en: 'Space-Grade Li-Ion', uk: 'Літій-іонні' },
    kgPerKwh: 7.0,
    costMPerKwh: 2.0,
  },
  {
    id: 'bat_solid',
    name: { en: 'Next-Gen Solid-State Li-Ion', uk: 'Твердотільні Li-Ion нового покоління' },
    kgPerKwh: 4.5,
    costMPerKwh: 3.5,
  },
]

/* ==================== ЗВ'ЯЗОК, ПАМ'ЯТЬ, ПРОЦЕСОР ==================== */
export const RADIOS: RadioSpec[] = [
  {
    id: 'rad_s',
    name: { en: 'S-Band Transceiver', uk: 'S-діапазон передавач' },
    targets: ['leo', 'moon', 'mars'],
    powerWatts: 18,
    massKg: 8,
    rateGbitPerHour: { leo: 5.0, moon: 2.5, mars: 1.4 },
    costM: 8,
  },
  {
    id: 'rad_x',
    name: { en: 'X-Band High-Gain Dish', uk: 'X-діапазон спрямована антена' },
    targets: ['leo', 'moon', 'mars'],
    powerWatts: 36,
    massKg: 16,
    rateGbitPerHour: { leo: 14.0, moon: 8.0, mars: 4.5 },
    costM: 16,
  },
  {
    id: 'rad_ka',
    name: { en: 'Ka-Band Deep-Space Link', uk: 'Ka-діапазон швидкісний канал' },
    targets: ['leo', 'moon', 'mars'],
    powerWatts: 62,
    massKg: 26,
    rateGbitPerHour: { leo: 32.0, moon: 20.0, mars: 11.0 },
    costM: 28,
  },
]

export const MEMORIES: MemorySpec[] = [
  {
    id: 'mem_32',
    name: { en: '32 Gbit Flash', uk: '32 Гбіт Flash' },
    capacityGbit: 32,
    massKg: 3,
    powerWatts: 4,
    costM: 4,
  },
  {
    id: 'mem_128',
    name: { en: '128 Gbit SSR', uk: '128 Гбіт SSR' },
    capacityGbit: 128,
    massKg: 6,
    powerWatts: 7,
    costM: 9,
  },
  {
    id: 'mem_512',
    name: { en: '512 Gbit SSR', uk: '512 Гбіт SSR' },
    capacityGbit: 512,
    massKg: 11,
    powerWatts: 12,
    costM: 16,
  },
  {
    id: 'mem_1024',
    name: { en: '1024 Gbit SSR', uk: '1024 Гбіт SSR' },
    capacityGbit: 1024,
    massKg: 18,
    powerWatts: 18,
    costM: 25,
  },
]

export const PROCESSORS: ProcessorSpec[] = [
  {
    id: 'proc_std',
    name: { en: 'Lossless Compression (×1.5)', uk: 'Стиснення без втрат (×1.5)' },
    label: { en: '×1.5', uk: '×1.5' },
    compression: 1.5,
    massKg: 3,
    powerWatts: 8,
    costM: 5,
  },
  {
    id: 'proc_fpga',
    name: { en: 'FPGA Onboard Pipeline (×2.5)', uk: 'FPGA-обробка на борту (×2.5)' },
    label: { en: '×2.5', uk: '×2.5' },
    compression: 2.5,
    massKg: 6,
    powerWatts: 18,
    costM: 12,
  },
]

export const GROUND_STATION_COSTS_M: Record<GroundStationCount, number> = {
  0: 0,
  1: 10,
  2: 20,
  3: 32,
}

export const DUTY_CYCLE_FACTOR: Record<DutyCycleId, number> = {
  eco: 1.0,
  normal: 1.0,
  max: 1.0,
}

/* ==================== ДЕТЕРМІНОВАНА ВАРІАТИВНІСТЬ ВІД SEED КІМНАТИ ==================== */

function jitterFactor(seed: number, key: string, spread = 0.12): number {
  let h = (seed ^ 0x9e3779b9) >>> 0
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0
  const unit = ((h ^ (h >>> 16)) >>> 0) / 4294967296 // [0, 1)
  return 1 + (unit * 2 - 1) * spread
}

function roundInt(val: number, min = 1): number {
  return Math.max(min, Math.round(val))
}

function roundTenth(val: number, min = 0.1): number {
  return Math.max(min, Math.round(val * 10) / 10)
}

export interface SeededCatalog {
  platforms: PlatformSpec[]
  instruments: InstrumentSpec[]
  rockets: RocketSpec[]
  adcsList: AdcsSpec[]
  engines: EngineSpec[]
  solarPanels: SolarPanelSpec[]
  batteries: BatterySpec[]
  radios: RadioSpec[]
  memories: MemorySpec[]
  processors: ProcessorSpec[]
}

export function getSeededCatalog(seed: number): SeededCatalog {
  return {
    platforms: PLATFORMS.map((p) => ({
      ...p,
      ownMassKg: roundInt(p.ownMassKg * jitterFactor(seed, `${p.id}:m`, 0.10)),
      coreWatts: roundInt(p.coreWatts * jitterFactor(seed, `${p.id}:w`, 0.10)),
      costM: roundInt(p.costM * jitterFactor(seed, `${p.id}:c`, 0.10)),
    })),
    instruments: INSTRUMENTS.map((inst) => ({
      ...inst,
      massKg: roundInt(inst.massKg * jitterFactor(seed, `${inst.id}:m`, 0.12)),
      powerWatts: roundInt(inst.powerWatts * jitterFactor(seed, `${inst.id}:w`, 0.12)),
      dataGbitPerHour: roundTenth(
        inst.dataGbitPerHour * jitterFactor(seed, `${inst.id}:d`, 0.12),
        0.1,
      ),
      sciencePoints: roundInt(inst.sciencePoints * jitterFactor(seed, `${inst.id}:s`, 0.12)),
      costM: roundInt(inst.costM * jitterFactor(seed, `${inst.id}:c`, 0.10)),
    })),
    rockets: ROCKETS.map((rk) => ({
      ...rk,
      capKg: {
        leo: roundInt(rk.capKg.leo * jitterFactor(seed, `${rk.id}:leo`, 0.08)),
        moon: roundInt(rk.capKg.moon * jitterFactor(seed, `${rk.id}:moon`, 0.08)),
        mars: roundInt(rk.capKg.mars * jitterFactor(seed, `${rk.id}:mars`, 0.08)),
      },
      costM: roundInt(rk.costM * jitterFactor(seed, `${rk.id}:c`, 0.10)),
    })),
    adcsList: ADCS_LIST.map((a) => ({
      ...a,
      scienceBonus: roundInt(a.scienceBonus * jitterFactor(seed, `${a.id}:s`, 0.12)),
      massKg: roundInt(a.massKg * jitterFactor(seed, `${a.id}:m`, 0.10)),
      powerWatts: roundInt(a.powerWatts * jitterFactor(seed, `${a.id}:w`, 0.10)),
      costM: roundInt(a.costM * jitterFactor(seed, `${a.id}:c`, 0.10)),
    })),
    engines: ENGINES.map((en) => ({
      ...en,
      massKg: roundInt(en.massKg * jitterFactor(seed, `${en.id}:m`, 0.10)),
      powerWatts: roundInt(en.powerWatts * jitterFactor(seed, `${en.id}:w`, 0.10)),
      costM: roundInt(en.costM * jitterFactor(seed, `${en.id}:c`, 0.10)),
    })),
    solarPanels: SOLAR_PANELS.map((sp) => ({
      ...sp,
      kgPerM2: roundTenth(sp.kgPerM2 * jitterFactor(seed, `${sp.id}:m`, 0.10), 0.5),
      costMPerM2: roundTenth(sp.costMPerM2 * jitterFactor(seed, `${sp.id}:c`, 0.10), 0.3),
    })),
    batteries: BATTERIES.map((b) => ({
      ...b,
      kgPerKwh: roundTenth(b.kgPerKwh * jitterFactor(seed, `${b.id}:m`, 0.10), 2.0),
      costMPerKwh: roundTenth(b.costMPerKwh * jitterFactor(seed, `${b.id}:c`, 0.10), 0.5),
    })),
    radios: RADIOS.map((rd) => ({
      ...rd,
      massKg: roundInt(rd.massKg * jitterFactor(seed, `${rd.id}:m`, 0.10)),
      powerWatts: roundInt(rd.powerWatts * jitterFactor(seed, `${rd.id}:w`, 0.10)),
      rateGbitPerHour: {
        leo: roundTenth(rd.rateGbitPerHour.leo * jitterFactor(seed, `${rd.id}:leo`, 0.10), 0.5),
        moon: roundTenth(rd.rateGbitPerHour.moon * jitterFactor(seed, `${rd.id}:moon`, 0.10), 0.5),
        mars: roundTenth(rd.rateGbitPerHour.mars * jitterFactor(seed, `${rd.id}:mars`, 0.10), 0.3),
      },
      costM: roundInt(rd.costM * jitterFactor(seed, `${rd.id}:c`, 0.10)),
    })),
    memories: MEMORIES.map((m) => ({
      ...m,
      massKg: roundInt(m.massKg * jitterFactor(seed, `${m.id}:m`, 0.10)),
      powerWatts: roundInt(m.powerWatts * jitterFactor(seed, `${m.id}:w`, 0.10)),
      costM: roundInt(m.costM * jitterFactor(seed, `${m.id}:c`, 0.10)),
    })),
    processors: PROCESSORS.map((pr) => ({
      ...pr,
      massKg: roundInt(pr.massKg * jitterFactor(seed, `${pr.id}:m`, 0.10)),
      powerWatts: roundInt(pr.powerWatts * jitterFactor(seed, `${pr.id}:w`, 0.10)),
      costM: roundInt(pr.costM * jitterFactor(seed, `${pr.id}:c`, 0.10)),
    })),
  }
}

export function createDefaultConfig(targetId: TargetId = 'leo'): MissionConfig {
  return {
    targetId,
    platformId: '',
    instrumentIds: [],
    panelId: '',
    panelAreaM2: 0,
    batteryId: '',
    batteryKwh: 0,
    optShield: false,
    optRedundancy: false,
    rocketId: 'rk_light',
    adcsId: '',
    engineId: '',
    radioId: '',
    memoryId: '',
    processorId: '',
    groundStations: 1,
    optRadHard: false,
    optEncryption: false,
  }
}