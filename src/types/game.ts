export type Lang = 'en' | 'uk'

export interface LocalizedText {
  en: string
  uk: string
}

export type PlayerRole = 'science' | 'bus' | 'flight' | 'comms'

export type JoinError = 'notFound' | 'full' | 'generic'

/** Гравець так, як він лежить у Firebase */
export interface RawPlayer {
  name: string
  joinedAt: number
  connections?: Record<string, true>
}

/** Кімната у Firebase (Firebase не зберігає порожні об'єкти, тому багато полів необов'язкові) */
export interface RawRoom {
  hostId: string
  seed: number
  counter?: number
  createdAt: number
  players?: Record<string, RawPlayer>
  claims?: Partial<Record<PlayerRole, string>>
}

/** Гравець, готовий до показу */
export interface Player {
  id: string
  name: string
  joinedAt: number
  online: boolean
}

/** Стан кімнати після обчислень: саме з ним працює інтерфейс */
export interface RoomState {
  code: string
  hostId: string
  seed: number
  counter: number
  players: Player[]
  roleOwners: Record<PlayerRole, string>
}