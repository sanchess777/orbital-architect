export type Lang = 'en' | 'uk'

export interface LocalizedText {
  en: string
  uk: string
}

export type PlayerRole = 'science' | 'bus' | 'flight' | 'comms'
export type TargetId = 'leo' | 'geo' | 'moon' | 'mars'
export type RoomPhase = 'lobby' | 'design' | 'report'
export type DutyCycleId = 'eco' | 'normal' | 'max'
export type GroundStationCount = 1 | 2 | 3

export type JoinError = 'notFound' | 'full' | 'generic'

/** Конфігурація космічної місії (синхронізується між 4 гравцями у Firebase) */
export interface MissionConfig {
  targetId: TargetId
  // Science Lead (Науковий керівник)
  instrumentIds: string[]
  dutyCycle: DutyCycleId
  // Spacecraft Engineer (Інженер апарата)
  platformId: string
  adcsId: string
  panelId: string
  panelAreaM2: number
  batteryId: string
  batteryKwh: number
  optRadHard: boolean
  optShield: boolean
  // Flight Dynamics (Балістик)
  orbitConfirmed: boolean
  rocketId: string
  engineId: string
  stationKeepingYears: number
  extraTestMonths: number
  acceptHighRisk: boolean
  // Comms & Ops (Зв'язок і ЦУП)
  radioId: string
  memoryId: string
  processorId: string
  groundStations: GroundStationCount
  optRedundancy: boolean
  optEncryption: boolean
}

/** Гравець так, як він лежить у Firebase */
export interface RawPlayer {
  name: string
  joinedAt: number
  connections?: Record<string, true>
}

/** Кімната у Firebase */
export interface RawRoom {
  hostId: string
  seed: number
  counter?: number
  createdAt: number
  players?: Record<string, RawPlayer>
  claims?: Partial<Record<PlayerRole, string>>
  // Ігровий стан місії
  phase?: RoomPhase
  attempt?: number
  config?: MissionConfig
  readyRoles?: Partial<Record<PlayerRole, boolean>>
}

/** Гравець, готовий до показу */
export interface Player {
  id: string
  name: string
  joinedAt: number
  online: boolean
}

/** Стан кімнати після обчислень */
export interface RoomState {
  code: string
  hostId: string
  seed: number
  counter: number
  players: Player[]
  roleOwners: Record<PlayerRole, string>
  phase: RoomPhase
  attempt: number
  config: MissionConfig
  readyRoles: Record<PlayerRole, boolean>
}

/* ==================== КАТАЛОГ ОБЛАДНАННЯ ==================== */

export type ThreatId = 'debris' | 'solar_flare' | 'cyber_attack' | 'conjunction'

export interface TargetThreat {
  id: ThreatId
  name: LocalizedText
  description: LocalizedText
  mitigationHint: LocalizedText
}

export interface MissionTarget {
  id: TargetId
  name: LocalizedText
  injectionOrbit: LocalizedText
  dvKmS: number
  dvBreakdown: LocalizedText
  flightDays: number
  distanceKm: number
  signalDelay: LocalizedText
  orbitPeriodMin: number
  eclipseMin: number
  solarFlux: number
  degradationPerYear: number
  maxDoD: number
  earthVisFrac: number
  stationCov: [number, number, number]
  maxGapHours: [number, number, number]
  skDvKmSPerYear: number
  tNomMonths: number
  bClassM: number
  tBaseMonths: number
  tMaxMonths: number
  windows: 'any' | 'monthly' | number[]
  bgRiskTransit: number
  bgRiskIns: number
  sMin: number
  sRef: number
  rMax: number
  rTeamM: number
  rOpsM: number
  analog: LocalizedText
  threats: [TargetThreat, TargetThreat]
}

export interface PlatformSpec {
  id: string
  name: LocalizedText
  maxDryMassKg: number
  maxInstruments: number
  ownMassKg: number
  coreWatts: number
  costM: number
  devMonths: number
  targets: TargetId[]
}

export interface InstrumentSpec {
  id: string
  name: LocalizedText
  targets: TargetId[]
  massKg: number
  powerWatts: number
  dataGbitPerDay: number
  sciencePoints: number
  costM: number
  trl: number
  pointingDeg: number
}

export interface RocketSpec {
  id: string
  name: LocalizedText
  capKg: Record<TargetId, number>
  costM: number
  reliability: number
  trl: number
  availableFromMonth: number
}

export interface EngineSpec {
  id: string
  name: LocalizedText
  ispSec: number
  dryMassKg: number
  powerWatts: number
  costM: number
  trl: number
  extraFlightDays: Record<TargetId, number>
}

export interface AdcsSpec {
  id: string
  name: LocalizedText
  pointingDeg: number
  massKg: number
  powerWatts: number
  costM: number
  trl: number
}

export interface SolarPanelSpec {
  id: string
  name: LocalizedText
  efficiency: number
  kgPerM2: number
  costMPerM2: number
  trl: number
}

export interface BatterySpec {
  id: string
  name: LocalizedText
  whPerKg: number
  costMPerKwh: number
  trl: number
}

export interface RadioSpec {
  id: string
  name: LocalizedText
  rfWatts: number
  powerWatts: number
  massKg: number
  rateMbps: Record<TargetId, number>
  pointingDeg: number
  costM: number
  trl: number
}

export interface MemorySpec {
  id: string
  name: LocalizedText
  capacityGbit: number
  massKg: number
  powerWatts: number
  costM: number
  trl: number
}

export interface ProcessorSpec {
  id: string
  name: LocalizedText
  label: LocalizedText
  compression: number
  massKg: number
  powerWatts: number
  costM: number
  trl: number
}

/* ==================== РЕЗУЛЬТАТ SOLVER.TS ==================== */

export type GateId = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8' | 'G9' | 'G10' | 'G11'

export interface GateStatus {
  id: GateId
  owners: PlayerRole[]
  passed: boolean
  title: LocalizedText
  summary: LocalizedText
  advice?: LocalizedText
}

export type MissionPhaseFail = 'launch' | 'transit' | 'ins' | 'ops'
export type MissionOutcome = 'success' | 'partial' | 'failed' | 'blocked'
export type MedalTier = 'gold' | 'silver' | 'bronze' | 'experimental'

export interface ThreatResult {
  threat: TargetThreat
  mitigated: boolean
  detail: LocalizedText
}

export interface MissionReport {
  // 8 ключових метрик верхньої панелі
  budgetUsedM: number
  budgetMaxM: number
  budgetReserveFrac: number

  dryMassKg: number
  dryMassLimitKg: number
  propellantMassKg: number
  launchMassKg: number
  rocketLimitKg: number

  powerGenEolWatts: number
  powerNeedLightWatts: number
  powerEclipseWatts: number

  batteryCapacityWh: number
  batteryRequiredWh: number
  actualDoD: number

  dataGenGbitDay: number
  dataDownlinkGbitDay: number
  memoryCapacityGbit: number
  memoryRequiredGbit: number

  devMonths: number
  launchMonth: number
  maxLaunchMonth: number
  waitMonths: number

  scienceRaw: number
  scienceInstalled: number
  sciencePotential: number
  scienceExpected: number
  scienceMin: number
  scienceRef: number

  failProbTotal: number
  failProbMax: number
  phaseProbs: Record<MissionPhaseFail, number>

  lifeMonths: number
  nominalMonths: number

  // Ворота Go / No-Go
  gates: GateStatus[]
  allGatesPassed: boolean

  // Симуляція польоту (детермінована за seed + attempt)
  outcome: MissionOutcome
  failedPhase?: MissionPhaseFail
  failureReason?: LocalizedText
  threatResults: ThreatResult[]
  telemetryLog: LocalizedText[]

  // Фінальна оцінка
  score: number
  medal: MedalTier
}