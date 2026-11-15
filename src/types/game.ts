export type Lang = 'en' | 'uk'

export interface LocalizedText {
  en: string
  uk: string
}

export type PlayerRole = 'science' | 'bus' | 'flight' | 'comms'
export type TargetId = 'leo' | 'moon' | 'mars'
export type RoomPhase = 'lobby' | 'design' | 'report'
export type DutyCycleId = 'eco' | 'normal' | 'max'
export type GroundStationCount = 0 | 1 | 2 | 3

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
  // Flight Engineer (Інженер польоту)
  rocketId: string
  engineId: string
  acceptHighRisk: boolean
  // Comms Officer (Зв'язківець)
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
  goal: LocalizedText
  injectionOrbit: LocalizedText
  flightDays: number
  signalDelay: LocalizedText
  solarFlux: number
  /** Найдовший безперервний час у тіні (год), на який має вистачити батареї */
  maxEclipseHours: number
  /** Годин зв'язку із Землею на добу для 0, 1, 2, 3 наземних станцій */
  contactHoursByStations: [number, number, number, number]
  /** Найдовша пауза без зв'язку (год) для 0, 1, 2, 3 наземних станцій */
  maxBlackoutHoursByStations: [number, number, number, number]
  tNomMonths: number
  bClassM: number
  bgRiskTransit: number
  bgRiskIns: number
  sMin: number
  sRef: number
  rMax: number
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
  targets: TargetId[]
}

export interface InstrumentSpec {
  id: string
  name: LocalizedText
  targets: TargetId[]
  massKg: number
  powerWatts: number
  dataGbitPerHour: number
  sciencePoints: number
  costM: number
  trl: number
  pointingDeg: number
}

export interface RocketSpec {
  id: string
  name: LocalizedText
  targets: TargetId[]
  capKg: Record<TargetId, number>
  costM: number
  reliability: number
  trl: number
}

export interface EngineSpec {
  id: string
  name: LocalizedText
  massKg: number
  powerWatts: number
  costM: number
  lifeYears: number
  trl: number
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
  targets: TargetId[]
  powerWatts: number
  massKg: number
  rateGbitPerHour: Record<TargetId, number>
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

export type MissionPhaseFail = 'launch' | 'transit' | 'ins' | 'ops'
export type MissionOutcome = 'success' | 'partial' | 'failed' | 'blocked'
export type MedalTier = 'gold' | 'silver' | 'bronze' | 'experimental'

export interface ThreatResult {
  threat: TargetThreat
  mitigated: boolean
  detail: LocalizedText
}

export interface MissionReport {
  budgetUsedM: number
  budgetMaxM: number
  budgetReserveFrac: number

  spacecraftMassKg: number
  dryMassLimitKg: number
  rocketLimitKg: number

  powerGenWatts: number
  powerNeedWatts: number

  batteryCapacityWh: number
  batteryRequiredWh: number

  dataRecGbitHour: number
  dataDownlinkGbitHour: number
  dataGenGbitDay: number
  dataDownlinkGbitDay: number
  contactHoursPerDay: number
  maxBlackoutHours: number

  memoryCapacityGbit: number
  memoryRequiredGbit: number

  platformName: LocalizedText | null
  instrumentsCount: number
  maxInstruments: number
  busCompatible: boolean

  adcsPointingDeg: number | null
  requiredPointingDeg: number
  adcsCompatible: boolean

  engineName: LocalizedText | null

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

  metricIssues: LocalizedText[]
  canLaunch: boolean

  outcome: MissionOutcome
  failedPhase?: MissionPhaseFail
  failureReason?: LocalizedText
  threatResults: ThreatResult[]
  telemetryLog: LocalizedText[]

  score: number
  medal: MedalTier
}